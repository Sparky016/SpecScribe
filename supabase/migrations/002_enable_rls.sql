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
  ON meetings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on transcript_turns"
  ON transcript_turns FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on diagram_snapshots"
  ON diagram_snapshots FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on agent_interventions"
  ON agent_interventions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on knowledge_chunks"
  ON knowledge_chunks FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
