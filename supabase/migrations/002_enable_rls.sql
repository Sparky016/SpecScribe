-- Enable RLS (audit finding #9)
--
-- The web dashboard does NOT talk to Supabase directly - all access flows
-- through the FastAPI backend using the service_role key, which BYPASSES RLS.
--
-- Therefore the correct policy here is DENY-ALL for the public API: no
-- permissive policies for anon/authenticated. This means that if the
-- publishable (anon) key is ever exposed, an attacker cannot read or modify
-- any meeting data.
--
-- To grant the dashboard direct browser reads later, add Supabase Auth and
-- introduce an explicit `to authenticated using (...)` policy keyed on
-- auth.uid(). Do NOT add a blanket permissive policy.

alter table meetings            enable row level security;
alter table transcript_turns    enable row level security;
alter table diagram_snapshots   enable row level security;
alter table agent_interventions enable row level security;
alter table knowledge_chunks    enable row level security;

-- Intentionally NO create policy statements: with RLS enabled and zero
-- policies, every statement by anon/authenticated is denied. service_role
-- continues to work because it has BYPASSRLS.