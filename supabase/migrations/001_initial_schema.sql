-- Enable pgvector extension
create extension if not exists vector;

-- 1. Meetings Table
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz default now(),
  latest_drawio_xml text,
  generated_spec_md text
);

-- 2. Speaker-Diarized Transcript Turns
create table if not exists transcript_turns (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  speaker_label text not null, -- e.g., "Speaker 0 (Ruan)", "Speaker 1"
  transcript_text text not null,
  timestamp_ms integer not null, -- Offset from meeting start
  created_at timestamptz default now()
);

create index if not exists idx_transcript_meeting_time
  on transcript_turns (meeting_id, timestamp_ms);

-- 3. Timestamped Diagram Snapshots & Decision Logs
create table if not exists diagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  timestamp_ms integer not null,
  drawio_xml text not null,
  overlay_image_url text,
  diff_summary text not null, -- e.g., "Added Redis Cache node between API and DB"
  decision_rationale text,    -- Synthesized "Why" from surrounding transcript_turns
  triggered_by text not null  -- 'VISION_DIFF' | 'PINCH_PALETTE' | 'AGENT_SUGGESTION'
);

create index if not exists idx_snapshots_meeting_time
  on diagram_snapshots (meeting_id, timestamp_ms);

-- 4. Raising-Hand Agent Interventions
create table if not exists agent_interventions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  timestamp_ms integer not null,
  category text not null,     -- 'VULNERABILITY' | 'LOGIC_FLAW' | 'ALTERNATIVE_IDEA' | 'RESEARCH'
  short_title text not null,  -- Max 28 chars for AR pill: e.g., "🚩 Auth Token Leak Risk"
  detailed_body text not null,
  was_pinched boolean default false
);

create index if not exists idx_interventions_meeting_time
  on agent_interventions (meeting_id, timestamp_ms);

-- 5. Unified Vector Store for Post-Meeting RAG Agent
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  chunk_type text not null,   -- 'DECISION' | 'TRANSCRIPT_WINDOW' | 'AGENT_INSIGHT' | 'TECH_SPEC'
  timestamp_ms integer,
  content text not null,
  embedding vector(1536)
);

create index if not exists idx_knowledge_meeting
  on knowledge_chunks (meeting_id);

-- Vector Similarity Search RPC
create or replace function match_knowledge_chunks (
  query_embedding vector(1536),
  match_meeting_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  chunk_type text,
  timestamp_ms integer,
  content text,
  similarity float
)
language sql stable
as $$
  select
    kc.id,
    kc.chunk_type,
    kc.timestamp_ms,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.meeting_id = match_meeting_id
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
