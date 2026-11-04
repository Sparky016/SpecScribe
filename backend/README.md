# SpecScribe AR Backend Orchestrator

FastAPI async orchestrator, in-memory `drawio-mcp` Sugiyama layout engine, Playwright headless transparent PNG renderer, and Raising-Hand proactive AI agent.

## Quickstart
```bash
# Install dependencies
pip install -r requirements.txt

# Seed demo data (dry-run without Supabase keys, or live with .env populated)
python seed_demo_meeting.py
```

## Dashboard endpoints
All require `Authorization: Bearer $SPECSCRIBE_API_TOKEN`.

- `GET /api/meetings?limit=50&offset=0`: captured meetings, newest first. Supabase rows are merged with in-memory meetings. Each item is `{id, title, created_at, finalized, is_live}`.
- `POST /api/meetings/{id}/ask`: body `{"question": "...", "history": [{"role": "user"|"assistant", "content": "..."}]}`. Only the last 10 history turns are used. Retrieval uses `knowledge_chunks`; if the meeting has none (it was never finalized), the meeting's raw transcript, snapshots, interventions and final diagram are searched instead. The response is `{answer, citations[]}` with `[MM:SS]` citations.
