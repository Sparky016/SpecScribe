-- Migration 007: Public anonymous read access (SELECT only)
-- Forward-only follow-up to 002_enable_rls.sql. Grants SELECT to the anon role on the
-- five core tables. No INSERT, UPDATE, DELETE or ALL policies are granted to anon or PUBLIC.

CREATE POLICY "Public read access on meetings"
  ON meetings FOR SELECT TO anon USING (true);

CREATE POLICY "Public read access on transcript_turns"
  ON transcript_turns FOR SELECT TO anon USING (true);

CREATE POLICY "Public read access on diagram_snapshots"
  ON diagram_snapshots FOR SELECT TO anon USING (true);

CREATE POLICY "Public read access on agent_interventions"
  ON agent_interventions FOR SELECT TO anon USING (true);

CREATE POLICY "Public read access on knowledge_chunks"
  ON knowledge_chunks FOR SELECT TO anon USING (true);
