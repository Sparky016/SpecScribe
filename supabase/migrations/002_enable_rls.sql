-- Migration 002: Enable Row-Level Security (RLS) and define access policies
-- Source: SPEC_DOC.md §4.4 (Finding #9)

-- 1. Enable RLS on all 5 core tables
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- 2. Service role full access policies (all operations)
CREATE POLICY "Service role full access on meetings"
  ON meetings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on transcript_turns"
  ON transcript_turns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on diagram_snapshots"
  ON diagram_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on agent_interventions"
  ON agent_interventions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on knowledge_chunks"
  ON knowledge_chunks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Public anonymous read access (SELECT) on all 5 tables
CREATE POLICY "Public read access on meetings"
  ON meetings FOR SELECT
  USING (true);

CREATE POLICY "Public read access on transcript_turns"
  ON transcript_turns FOR SELECT
  USING (true);

CREATE POLICY "Public read access on diagram_snapshots"
  ON diagram_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Public read access on agent_interventions"
  ON agent_interventions FOR SELECT
  USING (true);

CREATE POLICY "Public read access on knowledge_chunks"
  ON knowledge_chunks FOR SELECT
  USING (true);

-- 4. Public anonymous insert access on operational tables (meetings and transcript_turns)
CREATE POLICY "Public insert access on meetings"
  ON meetings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public insert access on transcript_turns"
  ON transcript_turns FOR INSERT
  WITH CHECK (true);

-- 5. Immutable history note:
-- UPDATE and DELETE operations are restricted to service_role by default
-- because no anon policies are declared for UPDATE or DELETE.