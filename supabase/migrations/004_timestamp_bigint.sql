-- Widen timestamp_ms columns (ms offsets from meeting start).
alter table transcript_turns alter column timestamp_ms type bigint;
alter table diagram_snapshots alter column timestamp_ms type bigint;
alter table agent_interventions alter column timestamp_ms type bigint;
alter table knowledge_chunks alter column timestamp_ms type bigint;

-- The RPC's return type must match the widened column.
drop function if exists match_knowledge_chunks(vector, uuid, float, int);
create or replace function match_knowledge_chunks (
  query_embedding vector(1536),
  match_meeting_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  chunk_type text,
  timestamp_ms bigint,
  content text,
  similarity float
)
language sql stable
set search_path = public, pg_temp
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
