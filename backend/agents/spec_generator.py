"""
SpecScribe AR - Post-Meeting Tech Spec & pgvector Embedding Pipeline (T-09)
Compiles Draw.io XML, decision logs, and agent interventions into Markdown Tech Specs,
generates 1536-dim knowledge chunks, and powers grounded post-meeting RAG with [MM:SS] citations.
"""

import asyncio
import json
import logging
import math
import os
import re
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

import llm
from agents.decision_linker import (
    generate_text_embedding,
    get_embedding_model,
    generate_text_embedding_async,
    generate_text_embeddings_batch_async,
)

try:
    from node_registry import NODE_REGISTRY
except ImportError:
    from backend.node_registry import NODE_REGISTRY

logger = logging.getLogger("specscribe.spec_generator")


def format_timestamp_ms(ms: int) -> str:
    """Internal helper: Formats millisecond offset into [MM:SS] exclusively for static Markdown tech-spec compilation and LLM citation prompts. All wire network payloads use raw integer milliseconds."""
    total_seconds = max(0, int(ms) // 1000)
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"


def parse_timestamp_label(label: str) -> int:
    """Parses 'MM:SS' or '[MM:SS]' label into milliseconds."""
    clean = label.strip("[] \t")
    parts = clean.split(":")
    if len(parts) == 2:
        try:
            return (int(parts[0]) * 60 + int(parts[1])) * 1000
        except ValueError:
            pass
    return 0


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Computes cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


NO_DATA_RECORDED = "No data recorded"


def extract_drawio_nodes(drawio_xml: str) -> List[Tuple[str, str]]:
    """
    Returns (label, type) for every labelled, non-edge draw.io cell in document order.
    Type is the NODE_REGISTRY key whose fillColor matches the cell style, otherwise 'other'.
    Unparseable XML yields no nodes rather than raising.
    """
    if not drawio_xml or not drawio_xml.strip():
        return []
    try:
        root = ET.fromstring(drawio_xml)
    except ET.ParseError as e:
        logger.debug("Could not parse draw.io XML for fallback spec: %s", e)
        return []

    type_by_fill = {d.fill_color.lower(): name for name, d in NODE_REGISTRY.items()}
    parent_of = {child: parent for parent in root.iter() for child in parent}
    nodes: List[Tuple[str, str]] = []
    for cell in root.iter("mxCell"):
        if cell.get("edge") == "1":
            continue
        label = cell.get("value", "")
        parent = parent_of.get(cell)
        if not label and parent is not None and parent.tag == "object":
            label = parent.get("label", "")
        label = label.strip()
        if not label:
            continue
        fill = re.search(r"(?:^|;)fillColor=(#[0-9a-fA-F]{6})", cell.get("style", ""))
        node_type = type_by_fill.get(fill.group(1).lower(), "other") if fill else "other"
        nodes.append((label, node_type))
    return nodes


class CitationItem(BaseModel):
    timestamp_ms: int
    label: str
    excerpt: str


class RAGResponseSchema(BaseModel):
    answer: str = Field(description="Grounded architectural answer with embedded [MM:SS] timestamp citations.")
    citations: List[CitationItem] = Field(default_factory=list)


FINALIZE_CHUNK_TYPES = ("TRANSCRIPT_WINDOW", "AGENT_INSIGHT", "TECH_SPEC")


class SpecGeneratorAgent:
    """
    Post-Meeting Technical Specification & pgvector Pipeline Agent (T-09).
    1. Compiles complete meeting artifacts into a comprehensive Markdown Technical Specification.
    2. Chunks and embeds decisions, dialogue windows, agent interventions, and spec sections into 1536-dim vectors.
    3. Serves grounded RAG Q&A with clickable [MM:SS] citations.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        supabase_client: Any = None,
        memory_store: Optional[Dict[str, Any]] = None,
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY")
        self.supabase_client = supabase_client
        self.memory_store = memory_store

    def _generate_deterministic_spec(
        self,
        meeting_id: str,
        meeting_title: str,
        drawio_xml: str,
        transcript_turns: List[Dict[str, Any]],
        diagram_snapshots: List[Dict[str, Any]],
        agent_interventions: List[Dict[str, Any]],
        created_time: str,
    ) -> str:
        """
        Offline fallback spec. Every section is derived from the inputs; a section with no
        recorded data says NO_DATA_RECORDED instead of asserting architecture the meeting never recorded.
        """
        nodes = extract_drawio_nodes(drawio_xml)

        if nodes or transcript_turns or diagram_snapshots or agent_interventions:
            counts = [
                f"{len(nodes)} diagram node(s)",
                f"{len(diagram_snapshots)} decision snapshot(s)",
                f"{len(agent_interventions)} agent intervention(s)",
                f"{len(transcript_turns)} transcript turn(s)",
            ]
            executive_summary = "Recorded in this session: " + ", ".join(counts) + "."
        else:
            executive_summary = NO_DATA_RECORDED

        architecture_lines: List[str] = []
        if nodes:
            labels_by_type: Dict[str, List[str]] = {}
            for label, node_type in nodes:
                labels_by_type.setdefault(node_type, []).append(label)
            for node_type in [*NODE_REGISTRY, "other"]:
                if node_type in labels_by_type:
                    joined = ", ".join(labels_by_type[node_type])
                    architecture_lines.append(f"- **{node_type.capitalize()}:** {joined}")
        architecture_section = "\n".join(architecture_lines) or NO_DATA_RECORDED

        xml_section = f"```xml\n{drawio_xml}\n```" if drawio_xml and drawio_xml.strip() else NO_DATA_RECORDED

        decision_rows = []
        for s in diagram_snapshots:
            ts_label = format_timestamp_ms(s.get("timestamp_ms", 0))
            diff = (s.get("diff_summary") or NO_DATA_RECORDED).replace("|", "/")
            why = (s.get("decision_rationale") or NO_DATA_RECORDED).replace("|", "/")
            trigger = s.get("triggered_by") or NO_DATA_RECORDED
            decision_rows.append(f"| `[{ts_label}]` | {diff} | {why} | `{trigger}` |")

        decisions_table = (
            "| Timestamp | Architectural Change | Decision Rationale (\"Why\") | Source |\n"
            "| :--- | :--- | :--- | :--- |\n"
            + "\n".join(decision_rows)
        ) if decision_rows else NO_DATA_RECORDED

        interventions = [
            (
                format_timestamp_ms(i.get("timestamp_ms", 0)),
                i.get("category") or NO_DATA_RECORDED,
                i.get("short_title") or NO_DATA_RECORDED,
                i.get("detailed_body") or NO_DATA_RECORDED,
            )
            for i in agent_interventions
        ]

        interventions_section = "\n".join(
            f"### `[{ts_label}]` {title} (`{category}`)\n{body}\n"
            for ts_label, category, title, body in interventions
        ) or NO_DATA_RECORDED

        action_items = "\n".join(
            f"- [ ] `[{ts_label}]` {title} (`{category}`): {body}"
            for ts_label, category, title, body in interventions
        ) or NO_DATA_RECORDED

        spec_md = f"""# Technical Specification: {meeting_title}

**Generated:** {created_time}  
**Session ID:** `{meeting_id}`  
**Status:** `FINALIZED`  

---

## 1. Executive Summary & Goals
{executive_summary}

## 2. System Architecture Overview & Component Matrix
{architecture_section}

## 3. Architecture Model (.drawio XML)
{xml_section}

## 4. Chronological Decision Log & Rationale Matrix
{decisions_table}

## 5. Security, Reliability & Failure Modes (Raising-Hand Audits)
{interventions_section}

## 6. Action Items & Implementation Roadmap
{action_items}
"""
        return spec_md.strip()

    async def compile_markdown_spec_async(
        self,
        meeting_id: str,
        meeting_title: str,
        drawio_xml: str,
        transcript_turns: List[Dict[str, Any]],
        diagram_snapshots: List[Dict[str, Any]],
        agent_interventions: List[Dict[str, Any]],
    ) -> str:
        """
        Asynchronously synthesizes a production-grade Markdown Technical Specification via the shared
        async llm helper. Non-blocking to the FastAPI event loop (Fixes #1).
        """
        created_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        if self.api_key:
            try:
                decisions_text = "\n".join([
                    f"- [{format_timestamp_ms(s.get('timestamp_ms', 0))}] {s.get('diff_summary', '')} | Rationale: {s.get('decision_rationale', 'N/A')}"
                    for s in diagram_snapshots
                ]) or "No explicit decision logs."

                interventions_text = "\n".join([
                    f"- [{format_timestamp_ms(i.get('timestamp_ms', 0))}] [{i.get('category', 'ALERT')}] {i.get('short_title', '')}: {i.get('detailed_body', '')}"
                    for i in agent_interventions
                ]) or "No agent interventions triggered."

                transcripts_summary = "\n".join([
                    f"[{format_timestamp_ms(t.get('timestamp_ms', 0))}] {t.get('speaker_label', 'Speaker')}: {t.get('transcript_text', '')}"
                    for t in transcript_turns[:30]
                ]) or "No speech recorded."

                prompt = (
                    "You are a Principal Software Architect generating a complete, professional Technical Specification document.\n"
                    f"Meeting ID: {meeting_id}\n"
                    f"Title: {meeting_title}\n"
                    f"Date: {created_time}\n\n"
                    "=== Architectural Decisions ===\n"
                    f"{decisions_text}\n\n"
                    "=== AI Raising-Hand Audits & Interventions ===\n"
                    f"{interventions_text}\n\n"
                    "=== Key Conversation Snippets ===\n"
                    f"{transcripts_summary}\n\n"
                    "Generate a thorough Markdown Technical Specification with the following sections:\n"
                    "# Technical Specification: <Title>\n"
                    "## 1. Executive Summary & Architectural Goals\n"
                    "## 2. System Architecture Overview & Component Responsibilities\n"
                    "## 3. Architecture Model (.drawio XML)\n"
                    "## 4. Chronological Decision Log & Rationale Matrix\n"
                    "## 5. Security, Reliability & Failure Modes (Audit Findings)\n"
                    "## 6. Action Items & Implementation Roadmap\n\n"
                    "IMPORTANT: In Section 3, embed the exact Draw.io XML inside a ```xml ... ``` code block:\n"
                    f"```xml\n{drawio_xml}\n```\n"
                )

                text = await llm.generate_structured(prompt, api_key=self.api_key)
                if text and len(text.strip()) > 100:
                    return text.strip()
                if text:
                    logger.warning("Gemini spec response too short (%d chars); using deterministic template", len(text.strip()))
            except Exception as e:
                logger.warning("Gemini async spec generation error: %s; falling back to deterministic template", e)

        return self._generate_deterministic_spec(
            meeting_id, meeting_title, drawio_xml, transcript_turns, diagram_snapshots, agent_interventions, created_time
        )

    def chunk_meeting_artifacts(
        self,
        meeting_id: str,
        spec_md: str,
        transcript_turns: List[Dict[str, Any]],
        diagram_snapshots: List[Dict[str, Any]],
        agent_interventions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Creates granular knowledge chunks across the finalize-owned chunk_types
        (DECISION chunks are written by DecisionLinker and are not created here):
        - 'TRANSCRIPT_WINDOW': Rolling transcript dialogue windows with speaker attribution.
        - 'AGENT_INSIGHT': Raising-hand interventions and technical critique cards.
        - 'TECH_SPEC': Structured excerpts from the generated Markdown specification.
        """
        chunks: List[Dict[str, Any]] = []

        # 1. TRANSCRIPT_WINDOW Chunks (rolling batches of 3-4 turns)
        batch_size = 4
        for i in range(0, len(transcript_turns), batch_size):
            batch = transcript_turns[i : i + batch_size]
            if not batch:
                continue
            start_ts = batch[0].get("timestamp_ms", 0)
            end_ts = batch[-1].get("timestamp_ms", 0)
            dialogue = "\n".join([
                f"{t.get('speaker_label', 'Speaker')} [{format_timestamp_ms(t.get('timestamp_ms', 0))}]: {t.get('transcript_text', '')}"
                for t in batch
            ])
            content = f"[{format_timestamp_ms(start_ts)} - {format_timestamp_ms(end_ts)}] Meeting Dialogue:\n{dialogue}"
            chunks.append({
                "meeting_id": meeting_id,
                "chunk_type": "TRANSCRIPT_WINDOW",
                "timestamp_ms": start_ts,
                "content": content,
            })

        # 2. AGENT_INSIGHT Chunks
        for item in agent_interventions:
            ts = item.get("timestamp_ms", 0)
            category = item.get("category", "REVIEW")
            title = item.get("short_title", "")
            body = item.get("detailed_body", "")
            content = f"[{format_timestamp_ms(ts)}] AI Teammate Intervention ({category}): {title}\nDetails: {body}"
            chunks.append({
                "meeting_id": meeting_id,
                "chunk_type": "AGENT_INSIGHT",
                "timestamp_ms": ts,
                "content": content,
            })

        # 3. TECH_SPEC Chunks (Section headers)
        sections = re.split(r"\n(?=## \d+\. )", spec_md)
        for idx, sec in enumerate(sections):
            clean_sec = sec.strip()
            if not clean_sec or clean_sec.startswith("```xml"):
                continue
            # Exclude raw draw.io xml dump from text search chunks to keep vector representations concise
            sec_without_xml = re.sub(r"```xml[\s\S]*?```", "[Draw.io XML Model Embedded]", clean_sec)
            chunks.append({
                "meeting_id": meeting_id,
                "chunk_type": "TECH_SPEC",
                "timestamp_ms": 0,
                "content": f"Technical Specification Section:\n{sec_without_xml[:1000]}",
            })

        return chunks

    async def embed_and_persist_chunks(
        self,
        meeting_id: str,
        raw_chunks: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Batch computes 1536-dimensional vector embeddings for all knowledge chunks
        concurrently/in-batch without blocking the event loop (Fixes #5), and persists
        them into Supabase knowledge_chunks table and memory_store in a single batch operation.
        """
        # 1. Non-blocking asynchronous batch embedding generation (Fixes #5)
        embeddings: List[Any] = []
        if raw_chunks:
            contents = [c["content"] for c in raw_chunks]
            embeddings = await generate_text_embeddings_batch_async(
                texts=contents,
                api_key=self.api_key,
                target_dim=1536,
            )

        persisted_chunks: List[Dict[str, Any]] = []
        for c, embedding in zip(raw_chunks, embeddings):
            if embedding is None:
                logger.warning("Embedding failed for %s chunk; skipping persistence", c.get("chunk_type"))
                continue
            chunk_id = str(uuid.uuid4())
            record = {
                "id": chunk_id,
                "meeting_id": meeting_id,
                "chunk_type": c["chunk_type"],
                "timestamp_ms": c.get("timestamp_ms", 0),
                "content": c["content"],
                "embedding": embedding,
                "embedding_model": get_embedding_model(),
            }
            persisted_chunks.append(record)

        # 2. Replace (not append) finalize-owned chunks so repeated /finalize calls stay idempotent.
        # DECISION chunks belong to DecisionLinker and are left untouched.
        if self.memory_store and "knowledge_chunks" in self.memory_store:
            existing = self.memory_store["knowledge_chunks"][meeting_id]
            existing[:] = [c for c in existing if c.get("chunk_type") not in FINALIZE_CHUNK_TYPES]
            existing.extend(persisted_chunks)

        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("knowledge_chunks")
                    .delete()
                    .eq("meeting_id", meeting_id)
                    .in_("chunk_type", list(FINALIZE_CHUNK_TYPES))
                    .execute()
                )
            except Exception as e:
                logger.warning("Supabase knowledge_chunks delete error: %s", e)

        # 3. Batch save in Supabase off-thread in a single round-trip
        if self.supabase_client and persisted_chunks:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("knowledge_chunks").insert(persisted_chunks).execute()
                )
            except Exception as e:
                logger.warning("Supabase batch knowledge_chunks insert error: %s", e)

        logger.info(
            "Batch embedded and persisted %d knowledge chunks (1536-dim) for meeting %s (non-blocking)",
            len(persisted_chunks),
            meeting_id,
        )
        return persisted_chunks

    async def finalize_meeting(
        self,
        meeting_id: str,
        drawio_xml: str,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes complete T-09 pipeline:
        1. Gathers all meeting data.
        2. Compiles final Markdown Technical Specification asynchronously (non-blocking).
        3. Updates meetings table with latest_drawio_xml and generated_spec_md.
        4. Chunks and embeds all artifacts into 1536-dim knowledge_chunks in batch.
        """
        # 1. Fetch all records from memory store / Supabase
        transcript_turns: List[Dict[str, Any]] = []
        diagram_snapshots: List[Dict[str, Any]] = []
        agent_interventions: List[Dict[str, Any]] = []
        meeting_meta: Dict[str, Any] = {}

        if self.memory_store:
            transcript_turns = list(self.memory_store.get("transcript_turns", {}).get(meeting_id, []))
            diagram_snapshots = list(self.memory_store.get("diagram_snapshots", {}).get(meeting_id, []))
            agent_interventions = list(self.memory_store.get("agent_interventions", {}).get(meeting_id, []))
            meeting_meta = self.memory_store.get("meetings", {}).get(meeting_id, {})

        if self.supabase_client:
            try:
                m_res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("meetings").select("*").eq("id", meeting_id).execute()
                )
                if m_res.data:
                    meeting_meta = m_res.data[0]
                t_res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("transcript_turns").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
                )
                if t_res.data:
                    transcript_turns = t_res.data
                s_res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("diagram_snapshots").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
                )
                if s_res.data:
                    diagram_snapshots = s_res.data
                i_res = await asyncio.to_thread(
                    lambda: self.supabase_client.table("agent_interventions").select("*").eq("meeting_id", meeting_id).order("timestamp_ms").execute()
                )
                if i_res.data:
                    agent_interventions = i_res.data
            except Exception as e:
                logger.warning("Supabase finalize fetch fallback: %s", e)

        m_title = title or meeting_meta.get("title") or f"Architecture Review {meeting_id[:8]}"

        # 2. Compile Markdown Tech Spec asynchronously (Fixes #1)
        spec_md = await self.compile_markdown_spec_async(
            meeting_id=meeting_id,
            meeting_title=m_title,
            drawio_xml=drawio_xml,
            transcript_turns=transcript_turns,
            diagram_snapshots=diagram_snapshots,
            agent_interventions=agent_interventions,
        )

        # 3. Update meeting record
        if self.memory_store and "meetings" in self.memory_store:
            if meeting_id not in self.memory_store["meetings"]:
                self.memory_store["meetings"][meeting_id] = {
                    "id": meeting_id,
                    "title": m_title,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            self.memory_store["meetings"][meeting_id]["latest_drawio_xml"] = drawio_xml
            self.memory_store["meetings"][meeting_id]["generated_spec_md"] = spec_md

        if self.supabase_client:
            try:
                await asyncio.to_thread(
                    lambda: self.supabase_client.table("meetings").update({
                        "latest_drawio_xml": drawio_xml,
                        "generated_spec_md": spec_md,
                    }).eq("id", meeting_id).execute()
                )
            except Exception as e:
                logger.warning("Supabase update meetings finalize error: %s", e)

        # 4. Chunk & embed into knowledge_chunks
        raw_chunks = self.chunk_meeting_artifacts(
            meeting_id=meeting_id,
            spec_md=spec_md,
            transcript_turns=transcript_turns,
            diagram_snapshots=diagram_snapshots,
            agent_interventions=agent_interventions,
        )
        persisted = await self.embed_and_persist_chunks(meeting_id, raw_chunks)

        return {
            "meeting_id": meeting_id,
            "title": m_title,
            "spec_md": spec_md,
            "chunks_created": len(persisted),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def answer_question(
        self,
        meeting_id: str,
        question: str,
        match_count: int = 5,
        match_threshold: float = 0.25,
    ) -> Dict[str, Any]:
        """
        Post-meeting RAG Q&A:
        1. Embeds question into 1536-dim vector.
        2. Retrieves top matching knowledge chunks (via Supabase match_knowledge_chunks RPC or in-memory cosine similarity).
        3. Synthesizes a grounded answer with clickable [MM:SS] timestamp citations.
        """
        query_vec = await generate_text_embedding_async(question, api_key=self.api_key, target_dim=1536)
        matched_chunks: List[Dict[str, Any]] = []
        if query_vec is None:
            logger.warning("Question embedding failed; skipping vector retrieval")

        # 1. Supabase pgvector RPC search
        if self.supabase_client and query_vec is not None:
            try:
                rpc_res = await asyncio.to_thread(
                    lambda: self.supabase_client.rpc(
                        "match_knowledge_chunks",
                        {
                            "query_embedding": query_vec,
                            "match_meeting_id": meeting_id,
                            "match_threshold": match_threshold,
                            "match_count": match_count,
                        },
                    ).execute()
                )
                if rpc_res.data:
                    matched_chunks = rpc_res.data
            except Exception as e:
                logger.warning("Supabase match_knowledge_chunks RPC fallback: %s", e)

        # 2. In-Memory Cosine Similarity fallback
        if not matched_chunks and self.memory_store and query_vec is not None:
            meeting_chunks = self.memory_store.get("knowledge_chunks", {}).get(meeting_id, [])
            scored: List[Tuple[float, Dict[str, Any]]] = []
            is_mock = not self.api_key

            stopwords = {
                "what", "is", "the", "of", "a", "an", "to", "in", "for", "and", "or",
                "on", "with", "at", "by", "from", "was", "were", "be", "been", "how",
                "why", "when", "where", "who", "which", "are", "do", "does", "did"
            }
            raw_q_words = set(re.findall(r"\w+", question.lower()))
            q_keywords = {w for w in raw_q_words if w not in stopwords} or raw_q_words

            for c in meeting_chunks:
                emb = c.get("embedding")
                content = c.get("content", "")
                if emb and len(emb) == len(query_vec):
                    sim = cosine_similarity(query_vec, emb)
                    if is_mock:
                        raw_c_words = set(re.findall(r"\w+", content.lower()))
                        c_keywords = {w for w in raw_c_words if w not in stopwords} or raw_c_words
                        overlap = len(q_keywords.intersection(c_keywords))
                        # Keyword overlap gives direct signal in offline mode
                        if overlap > 0:
                            sim = max(sim, (overlap / max(1, len(q_keywords))) * 0.7 + 0.3)
                    if sim >= match_threshold:
                        scored.append((sim, c))

            # Fallback to best available chunk if no chunk surpassed match_threshold
            if not scored and meeting_chunks:
                for c in meeting_chunks:
                    emb = c.get("embedding")
                    if emb:
                        sim = cosine_similarity(query_vec, emb)
                        scored.append((sim, c))

            # Prioritize granular DECISION and TRANSCRIPT_WINDOW chunks for specific architectural queries
            scored.sort(
                key=lambda x: (
                    1 if x[1].get("chunk_type") in ("DECISION", "TRANSCRIPT_WINDOW") else 0,
                    x[0],
                ),
                reverse=True,
            )
            matched_chunks = [
                {
                    "id": item.get("id"),
                    "chunk_type": item.get("chunk_type"),
                    "timestamp_ms": item.get("timestamp_ms", 0),
                    "content": item.get("content", ""),
                    "similarity": round(sim, 4),
                }
                for sim, item in scored[:match_count]
            ]

        # 3. Grounded Answer Synthesis
        citations: List[Dict[str, Any]] = []
        for c in matched_chunks:
            ts = c.get("timestamp_ms", 0)
            citations.append({
                "timestamp_ms": ts,
                "label": format_timestamp_ms(ts),
                "excerpt": c.get("content", "")[:120],
            })
        # Ensure temporal citations with timestamp_ms > 0 are prioritized over 00:00 document headers
        citations.sort(key=lambda c: (1 if c["timestamp_ms"] > 0 else 0), reverse=True)

        if self.api_key and matched_chunks:
            try:
                chunks_context = "\n---\n".join([
                    f"[{format_timestamp_ms(c.get('timestamp_ms', 0))}] (Type: {c.get('chunk_type')}): {c.get('content')}"
                    for c in matched_chunks
                ])

                prompt = (
                    "You are SpecScribe's Post-Meeting RAG Q&A Assistant.\n"
                    "Answer the user's question about the architectural meeting based STRICTLY on the retrieved knowledge chunks below.\n"
                    "RULES:\n"
                    "1. For every claim, architectural change, or decision, cite the exact timestamp in brackets like [MM:SS] (e.g., [00:36]).\n"
                    "2. If the answer cannot be determined from the chunks, state that clearly.\n"
                    "3. Keep the tone concise, authoritative, and grounded.\n\n"
                    f"Question: {question}\n\n"
                    f"Retrieved Meeting Knowledge Chunks:\n{chunks_context}\n"
                )

                text = await llm.generate_structured(prompt, api_key=self.api_key)
                if text:
                    answer_text = text.strip()
                    # Extract timestamp citations from the generated answer
                    found_timestamps = re.findall(r"\[(\d{2}:\d{2})\]", answer_text)
                    refined_citations = []
                    seen_labels = set()
                    for f_ts in found_timestamps:
                        if f_ts not in seen_labels:
                            seen_labels.add(f_ts)
                            ms = parse_timestamp_label(f_ts)
                            # Find excerpt
                            matched_c = next((c for c in matched_chunks if format_timestamp_ms(c.get("timestamp_ms", 0)) == f_ts), None)
                            excerpt = matched_c.get("content", "")[:120] if matched_c else f"Meeting discussion at {f_ts}"
                            refined_citations.append({
                                "timestamp_ms": ms,
                                "label": f_ts,
                                "excerpt": excerpt,
                            })

                    if refined_citations:
                        refined_citations.sort(key=lambda c: (1 if c["timestamp_ms"] > 0 else 0), reverse=True)

                    return {
                        "meeting_id": meeting_id,
                        "question": question,
                        "answer": answer_text,
                        "citations": refined_citations or citations,
                    }
            except Exception as e:
                logger.warning("Gemini RAG synthesis error: %s; using grounded template", e)

        # Deterministic / Heuristic Grounded Answer Fallback
        if matched_chunks:
            top_chunk = matched_chunks[0]
            top_ts = top_chunk.get("timestamp_ms", 0)
            top_label = format_timestamp_ms(top_ts)
            content_clean = top_chunk.get("content", "").replace("\n", " ")

            answer = (
                f"Based on meeting records at [{top_label}], the decision was made: {content_clean}. "
                f"This decision addressed architectural requirements and system performance goals."
            )
            return {
                "meeting_id": meeting_id,
                "question": question,
                "answer": answer,
                "citations": citations[:3],
            }

        return {
            "meeting_id": meeting_id,
            "question": question,
            "answer": "No directly matching architectural decisions or dialogue were found in this meeting timeline.",
            "citations": [],
        }
