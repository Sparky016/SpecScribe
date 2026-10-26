-- Migration 005: record which embedding model produced each knowledge_chunks vector.
-- Forward-only. Existing rows stay NULL (model unknown / legacy mixed-model data).
-- match_knowledge_chunks (001/003) assumes vector(1536); the pinned model is requested at 1536 dims.

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding_model text;
