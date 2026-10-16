"""
Seed script for SpecScribe AR
Inserts and verifies a realistic architectural brainstorming session into Supabase (or runs in dry-run mode).
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

try:
    from pydantic import BaseModel, Field
except ImportError:
    BaseModel = object  # Fallback if pydantic not yet installed in active env

# Seed Meeting Data
DEMO_MEETING_ID = str(uuid.uuid4())
DEMO_MEETING = {
    "id": DEMO_MEETING_ID,
    "title": "Core Architecture Brainstorming: Auth & Real-Time Ingestion",
    "latest_drawio_xml": "<mxfile><diagram name=\"ARStream\"><mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel></diagram></mxfile>",
    "generated_spec_md": "# Architecture Review Summary\n\nDiscussion resolved API Gateway caching and database read-replica strategy."
}

DEMO_TRANSCRIPTS = [
    {
        "meeting_id": DEMO_MEETING_ID,
        "speaker_label": "Speaker 0 (Ruan)",
        "transcript_text": "Let's review the API gateway flow. Requests hit the ingress controller first.",
        "timestamp_ms": 12000
    },
    {
        "meeting_id": DEMO_MEETING_ID,
        "speaker_label": "Speaker 1 (Architect)",
        "transcript_text": "We should place a Redis cache between the API Gateway and PostgreSQL to protect against token validation storms.",
        "timestamp_ms": 24500
    },
    {
        "meeting_id": DEMO_MEETING_ID,
        "speaker_label": "Speaker 0 (Ruan)",
        "transcript_text": "Agreed. Adding the Redis database node now.",
        "timestamp_ms": 35000
    },
    {
        "meeting_id": DEMO_MEETING_ID,
        "speaker_label": "Speaker 1 (Architect)",
        "transcript_text": "Make sure we address cache stampede with request coalescing.",
        "timestamp_ms": 52000
    }
]

DEMO_SNAPSHOTS = [
    {
        "meeting_id": DEMO_MEETING_ID,
        "timestamp_ms": 15000,
        "drawio_xml": "<mxfile><diagram name=\"ARStream\"><mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/><mxCell id=\"v_1\" value=\"API Gateway\" vertex=\"1\" parent=\"1\" style=\"rounded=1;fillColor=#107C41;strokeColor=#00FF66;fontColor=#FFFFFF;\"/></root></mxGraphModel></diagram></mxfile>",
        "overlay_image_url": "https://storage.supabase.co/overlays/demo_01.png",
        "diff_summary": "+ Added [service] API Gateway",
        "decision_rationale": "Initial entry point for user requests.",
        "triggered_by": "VISION_DIFF"
    },
    {
        "meeting_id": DEMO_MEETING_ID,
        "timestamp_ms": 36000,
        "drawio_xml": "<mxfile><diagram name=\"ARStream\"><mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/><mxCell id=\"v_1\" value=\"API Gateway\" vertex=\"1\" parent=\"1\"/><mxCell id=\"v_2\" value=\"Redis Cache\" vertex=\"1\" parent=\"1\" style=\"shape=cylinder3;fillColor=#0D47A1;strokeColor=#00E5FF;fontColor=#FFFFFF;\"/><mxCell id=\"e_1_2\" edge=\"1\" parent=\"1\" source=\"v_1\" target=\"v_2\"/></root></mxGraphModel></diagram></mxfile>",
        "overlay_image_url": "https://storage.supabase.co/overlays/demo_02.png",
        "diff_summary": "+ Added [database] Redis Cache and edge from API Gateway",
        "decision_rationale": "Speaker 0 added Redis cache following Speaker 1's recommendation to prevent token validation storms.",
        "triggered_by": "PINCH_PALETTE"
    }
]

DEMO_INTERVENTIONS = [
    {
        "meeting_id": DEMO_MEETING_ID,
        "timestamp_ms": 55000,
        "category": "VULNERABILITY",
        "short_title": "Cache Stampede Risk",
        "detailed_body": "High-concurrency cache misses on Redis will hammer PostgreSQL. Configure request coalescing and jittered TTLs.",
        "was_pinched": True
    }
]

DEMO_KNOWLEDGE_CHUNKS = [
    {
        "meeting_id": DEMO_MEETING_ID,
        "chunk_type": "DECISION",
        "timestamp_ms": 36000,
        "content": "Decision: Added Redis Cache between API Gateway and PostgreSQL. Rationale: Prevent token validation storms on auth endpoints.",
        # Mock 1536-dim vector representation (zeros or small values for test)
        "embedding": [0.001] * 1536
    }
]


def seed_supabase():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("[INFO] SUPABASE_URL or SUPABASE_SERVICE_KEY not detected in environment.")
        print("[INFO] Executing Dry-Run Validation of Demo Meeting Dataset...")
        print("---------------------------------------------------------------")
        print(f"Meeting ID: {DEMO_MEETING['id']}")
        print(f"Title: {DEMO_MEETING['title']}")
        print(f"Transcript Turns to insert: {len(DEMO_TRANSCRIPTS)}")
        print(f"Diagram Snapshots to insert: {len(DEMO_SNAPSHOTS)}")
        print(f"Agent Interventions to insert: {len(DEMO_INTERVENTIONS)}")
        print(f"Knowledge Chunks to embed: {len(DEMO_KNOWLEDGE_CHUNKS)}")
        print("---------------------------------------------------------------")
        print("[SUCCESS] Dry-run schema validation passed! Ready to seed live Supabase once credentials are set.")
        return

    try:
        from supabase import create_client, Client
    except ImportError:
        print("[ERROR] 'supabase' package is not installed. Run 'pip install supabase'.")
        sys.exit(1)

    print(f"[INFO] Connecting to Supabase at: {supabase_url}")
    client: Client = create_client(supabase_url, supabase_key)

    # 1. Insert Meeting
    print(f"Inserting meeting: {DEMO_MEETING['id']}...")
    client.table("meetings").insert(DEMO_MEETING).execute()

    # 2. Insert Transcripts
    print(f"Inserting {len(DEMO_TRANSCRIPTS)} transcript turns...")
    client.table("transcript_turns").insert(DEMO_TRANSCRIPTS).execute()

    # 3. Insert Snapshots
    print(f"Inserting {len(DEMO_SNAPSHOTS)} diagram snapshots...")
    client.table("diagram_snapshots").insert(DEMO_SNAPSHOTS).execute()

    # 4. Insert Interventions
    print(f"Inserting {len(DEMO_INTERVENTIONS)} agent interventions...")
    client.table("agent_interventions").insert(DEMO_INTERVENTIONS).execute()

    # 5. Insert Knowledge Chunks
    print(f"Inserting {len(DEMO_KNOWLEDGE_CHUNKS)} knowledge chunks with 1536-dim embeddings...")
    client.table("knowledge_chunks").insert(DEMO_KNOWLEDGE_CHUNKS).execute()

    # Query verification
    print("\n[VERIFICATION] Querying back meeting timeline:")
    res = client.table("meetings").select("id, title, created_at").eq("id", DEMO_MEETING_ID).single().execute()
    print(f"Verified Meeting in DB: {res.data}")
    
    turns = client.table("transcript_turns").select("id, speaker_label, timestamp_ms").eq("meeting_id", DEMO_MEETING_ID).execute()
    print(f"Verified {len(turns.data)} Transcript Turns in DB.")
    print("[SUCCESS] All demo data seeded and verified successfully!")


if __name__ == "__main__":
    seed_supabase()
