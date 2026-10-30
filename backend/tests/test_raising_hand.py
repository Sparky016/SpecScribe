"""
Unit tests for RaisingHandAgent Supabase transcript_turns fallback (Task 58 - AC3).
Verifies:
- When memory_store["transcript_turns"] is empty (e.g., after a backend restart),
  RaisingHandAgent._get_recent_context() and evaluate_proactive_async() fall back to
  querying Supabase transcript_turns for the last 60s window.
"""

import os
import sys
from unittest.mock import MagicMock
import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from agents.raising_hand_agent import RaisingHandAgent


class _MockSupabaseWithTranscripts:
    def __init__(self, rows):
        self.rows = rows
        self.queried_tables = []
        self.queried_meetings = []

    def table(self, name):
        outer = self
        outer.queried_tables.append(name)

        class _Query:
            def select(self, *_a, **_k):
                return self

            def eq(self, col, val):
                if col == "meeting_id":
                    outer.queried_meetings.append(val)
                return self

            def order(self, *_a, **_k):
                return self

            def insert(self, *_a, **_k):
                return self

            def execute(self):
                res = MagicMock()
                res.data = list(outer.rows)
                return res

        return _Query()


@pytest.mark.asyncio
async def test_raising_hand_get_recent_context_falls_back_to_supabase():
    """
    AC3: When in-memory transcript_turns is empty for a meeting, RaisingHandAgent._get_recent_context
    retrieves the last 60s of transcript_turns from Supabase.
    """
    meeting_id = "00000000-0000-4000-8000-000000000585"
    supabase_turns = [
        {
            "id": "db-t1",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 0 (Wearer)",
            "transcript_text": "Early turn outside the 60s window.",
            "timestamp_ms": 5000,
        },
        {
            "id": "db-t2",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 1 (Architect)",
            "transcript_text": "Let us add a Redis cache layer in front of the primary database.",
            "timestamp_ms": 45000,
        },
        {
            "id": "db-t3",
            "meeting_id": meeting_id,
            "speaker_label": "Speaker 0 (Wearer)",
            "transcript_text": "We also need an authentication token service on ingress.",
            "timestamp_ms": 75000,
        },
    ]

    mock_sb = _MockSupabaseWithTranscripts(supabase_turns)
    # Empty in-memory transcript_turns simulating a backend restart
    empty_memory_store = {
        "transcript_turns": {},
        "agent_interventions": {meeting_id: []},
    }

    agent = RaisingHandAgent(
        api_key="",
        supabase_client=mock_sb,
        memory_store=empty_memory_store,
    )

    # 1. Verify _get_recent_context works both when awaited and called synchronously
    turns_awaited = await agent._get_recent_context(meeting_id, timestamp_ms=80000, window_ms=60000)
    assert len(turns_awaited) == 2
    assert [t["id"] for t in turns_awaited] == ["db-t2", "db-t3"]
    assert "transcript_turns" in mock_sb.queried_tables
    assert meeting_id in mock_sb.queried_meetings

    turns_sync = agent._get_recent_context(meeting_id, timestamp_ms=80000, window_ms=60000)
    assert [t["id"] for t in turns_sync] == ["db-t2", "db-t3"]

    # 2. Verify evaluate_proactive_async uses the Supabase fallback turns to detect architectural risks
    evaluation = await agent.evaluate_proactive_async(
        meeting_id=meeting_id,
        timestamp_ms=80000,
        drawio_xml="<mxfile/>",
    )
    assert evaluation.trigger is True
    assert evaluation.category == "VULNERABILITY"
    assert "Stampede" in evaluation.short_title


@pytest.mark.asyncio
async def test_raising_hand_prefers_memory_store_when_populated():
    """
    AC3: When memory_store["transcript_turns"] is already populated, RaisingHandAgent uses
    in-memory turns without querying Supabase.
    """
    meeting_id = "00000000-0000-4000-8000-000000000586"
    mock_sb = _MockSupabaseWithTranscripts([])
    memory_store = {
        "transcript_turns": {
            meeting_id: [
                {
                    "id": "mem-t1",
                    "meeting_id": meeting_id,
                    "speaker_label": "Speaker 0",
                    "transcript_text": "In-memory turn about PostgreSQL single database.",
                    "timestamp_ms": 50000,
                }
            ]
        },
        "agent_interventions": {meeting_id: []},
    }

    agent = RaisingHandAgent(
        api_key="",
        supabase_client=mock_sb,
        memory_store=memory_store,
    )

    turns = await agent._get_recent_context(meeting_id, timestamp_ms=60000, window_ms=60000)
    assert len(turns) == 1
    assert turns[0]["id"] == "mem-t1"
    assert mock_sb.queried_tables == []
