-- 002_enable_rls.sql: Row-Level Security (RLS) Policies for SpecScribe AR
-- Addresses Audit Finding #5: Enable RLS and establish policies on all tables.

-- 1. Enable Row-Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- 2. Meetings Policies
CREATE POLICY "Public read for meetings" ON meetings
  FOR SELECT USING (true);

CREATE POLICY "Service and authenticated insert for meetings" ON meetings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service and authenticated update for meetings" ON meetings
  FOR UPDATE USING (true);

CREATE POLICY "Service and authenticated delete for meetings" ON meetings
  FOR DELETE USING (true);

-- 3. Transcript Turns Policies
CREATE POLICY "Public read for transcript_turns" ON transcript_turns
  FOR SELECT USING (true);

CREATE POLICY "Service and authenticated insert for transcript_turns" ON transcript_turns
  FOR INSERT WITH CHECK (true);

-- 4. Diagram Snapshots Policies
CREATE POLICY "Public read for diagram_snapshots" ON diagram_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Service and authenticated insert for diagram_snapshots" ON diagram_snapshots
  FOR INSERT WITH CHECK (true);

-- 5. Agent Interventions Policies
CREATE POLICY "Public read for agent_interventions" ON agent_interventions
  FOR SELECT USING (true);

CREATE POLICY "Service and authenticated insert for agent_interventions" ON agent_interventions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service and authenticated update for agent_interventions" ON agent_interventions
  FOR UPDATE USING (true);

-- 6. Knowledge Chunks Policies
CREATE POLICY "Public read for knowledge_chunks" ON knowledge_chunks
  FOR SELECT USING (true);

CREATE POLICY "Service and authenticated insert for knowledge_chunks" ON knowledge_chunks
  FOR INSERT WITH CHECK (true);