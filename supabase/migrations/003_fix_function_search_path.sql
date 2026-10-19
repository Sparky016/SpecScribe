-- Pin the search_path so the function cannot be hijacked by a caller who
-- controls their session search_path (Supabase advisor: function_search_path_mutable).
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
language sql
stable
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