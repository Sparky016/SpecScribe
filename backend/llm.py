"""
SpecScribe AR - Shared async Gemini generation helper.
Owns model selection (candidate fallback + GEMINI_MODEL override), the per-call timeout,
one shared genai.Client, and WARNING logging of failed model attempts.
Embedding calls are not routed through here (see agents.decision_linker).
"""

import asyncio
import logging
import os
from typing import Any, List, Optional

logger = logging.getLogger("specscribe.llm")

DEFAULT_CANDIDATE_MODELS = ("gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash")
DEFAULT_TIMEOUT_SECONDS = 30.0
TIMEOUT_ENV_VAR = "SPECSCRIBE_LLM_TIMEOUT_SECONDS"

# One shared client, rebuilt only when the API key changes.
_client: Any = None
_client_key: Optional[str] = None


def get_candidate_models() -> List[str]:
    """Models tried in order; GEMINI_MODEL (if set and not already listed) is tried first."""
    candidate_models = list(DEFAULT_CANDIDATE_MODELS)
    configured_model = os.environ.get("GEMINI_MODEL")
    if configured_model and configured_model not in candidate_models:
        candidate_models.insert(0, configured_model)
    return candidate_models


def get_timeout_seconds() -> float:
    """Per-attempt timeout from SPECSCRIBE_LLM_TIMEOUT_SECONDS; invalid or non-positive values use the default."""
    raw = os.environ.get(TIMEOUT_ENV_VAR)
    if not raw:
        return DEFAULT_TIMEOUT_SECONDS
    try:
        value = float(raw)
    except ValueError:
        logger.warning("Invalid %s=%r; using default %.1fs", TIMEOUT_ENV_VAR, raw, DEFAULT_TIMEOUT_SECONDS)
        return DEFAULT_TIMEOUT_SECONDS
    if value <= 0:
        logger.warning("Non-positive %s=%r; using default %.1fs", TIMEOUT_ENV_VAR, raw, DEFAULT_TIMEOUT_SECONDS)
        return DEFAULT_TIMEOUT_SECONDS
    return value


def _get_client(api_key: str) -> Any:
    """Returns the shared genai.Client for api_key, or None if it cannot be constructed."""
    global _client, _client_key
    if _client is not None and _client_key == api_key:
        return _client
    try:
        from google import genai

        client = genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning("Could not initialize Google GenAI Client: %s", e)
        return None
    _client = client
    _client_key = api_key
    return client


async def generate_structured(
    prompt: str,
    schema: Any = None,
    contents: Optional[List[Any]] = None,
    api_key: Optional[str] = None,
) -> Optional[str]:
    """
    Generates content with Gemini, trying each candidate model in order.

    - schema: optional response schema; when given the response is requested as JSON.
    - contents: optional extra parts (e.g. an image Part) sent before the prompt.
    - api_key: defaults to GEMINI_API_KEY; with no key, returns None without calling Gemini.

    Each attempt is bounded by asyncio.wait_for (SPECSCRIBE_LLM_TIMEOUT_SECONDS). Failed, timed-out
    or empty attempts are logged at WARNING and the next model is tried. Returns the first non-empty
    response text, or None when every model failed; callers own parsing and fallback behaviour.
    """
    key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY")
    if not key:
        return None

    client = _get_client(key)
    if client is None:
        return None

    config = None
    if schema is not None:
        try:
            from google.genai import types

            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
            )
        except Exception as e:
            logger.warning("Could not build Gemini response config: %s", e)
            return None

    request_contents = [*(contents or []), prompt]
    timeout_s = get_timeout_seconds()

    for model_name in get_candidate_models():
        kwargs = {"model": model_name, "contents": request_contents}
        if config is not None:
            kwargs["config"] = config
        try:
            response = await asyncio.wait_for(client.aio.models.generate_content(**kwargs), timeout=timeout_s)
        except asyncio.TimeoutError:
            logger.warning("Gemini model %s timed out after %.1fs; trying next", model_name, timeout_s)
            continue
        except Exception as e:
            logger.warning("Gemini model %s failed: %s; trying next", model_name, e)
            continue

        text = getattr(response, "text", None) if response is not None else None
        if text and text.strip():
            return text
        logger.warning("Gemini model %s returned an empty response; trying next", model_name)

    logger.warning("All Gemini models failed or returned empty responses")
    return None
