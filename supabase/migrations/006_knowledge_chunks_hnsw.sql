-- Migration 006: Add HNSW index on knowledge_chunks.embedding for ANN vector search
-- Uses cosine distance operator class (vector_cosine_ops) to accelerate match_knowledge_chunks

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
