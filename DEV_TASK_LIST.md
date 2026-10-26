# Dev Task List

source: docs/reviews/2026-10-25-repo-prd-audit.md (findings #1–#47, judged against PRD.md v1.1.0 + docs/prd.md)
generated: 2026-10-25 16:37
updated: 2026-10-25 16:37

Status values: PENDING | IN_PROGRESS | EVAL | REWORK | DONE | BLOCKED

Human markers (also in each YAML as `human_action`):
- **🧑 HUMAN** — human-only task; no worker dispatch.
- **🧑 GATE** — needs a human decision or approval *before* a worker is dispatched.
- **🧑 STEP** — worker does the code; a human must do one step (deploy env, Lens Studio check, triage) before it is DONE.

Phases: **1** Stop the bleeding — security & trustworthy tests; **2** Backend correctness & data integrity; **3** Lens & dashboard alignment with PRD; **4** Refactor, hygiene & future

## Tasks

| ID | Phase | Task | Severity | Complexity | Effort | Depends On | Status | Commit |
|----|-------|------|----------|------------|--------|------------|--------|--------|
| 01 | 1 | 🧑 GATE [Revert permissive RLS migration 002](DEV_TASK_01.yml) | critical | trivial | low | — | PENDING | — |
| 02 | 1 | [Fix Lens test harness to test the current build](DEV_TASK_02.yml) | high | low | medium | — | PENDING | — |
| 03 | 1 | [Require bearer-token auth on backend REST and WebSocket](DEV_TASK_03.yml) | high | medium | high | — | PENDING | — |
| 04 | 1 | [Rate-limit Gemini-backed POST routes](DEV_TASK_04.yml) | high | low | medium | 03 | PENDING | — |
| 05 | 1 | [Dashboard proxy forwards the backend API token](DEV_TASK_05.yml) | high | low | medium | 03 | PENDING | — |
| 06 | 1 | 🧑 HUMAN [Provision SPECSCRIBE_API_TOKEN secrets](DEV_TASK_06.yml) | high | trivial | low | 03, 05 | PENDING | — |
| 07 | 1 | [Validate and encode meeting IDs in dashboard proxy](DEV_TASK_07.yml) | medium | low | low | 05 | PENDING | — |
| 08 | 1 | [Centralise Lens Studio MCP token in an env-backed client](DEV_TASK_08.yml) | medium | medium | medium | — | PENDING | — |
| 09 | 1 | 🧑 HUMAN [Rotate Lens Studio MCP token and purge from history](DEV_TASK_09.yml) | medium | low | low | 08 | PENDING | — |
| 10 | 2 | [Stop fabricating diagram nodes in vision fallback](DEV_TASK_10.yml) | high | low | medium | — | PENDING | — |
| 11 | 2 | [Use per-session elapsed time for proactive timestamps](DEV_TASK_11.yml) | high | medium | medium | — | PENDING | — |
| 12 | 2 | [Persist meetings row on WS session creation and enforce UUID IDs](DEV_TASK_12.yml) | high | medium | medium | — | PENDING | — |
| 13 | 2 | [Dedupe graph nodes only when label and type match](DEV_TASK_13.yml) | high | low | medium | — | PENDING | — |
| 14 | 2 | [Add CONCLUDE_MEETING handler and shared pinch-action contract](DEV_TASK_14.yml) | high | medium | medium | 16 | PENDING | — |
| 15 | 2 | 🧑 HUMAN [Apply new migrations to the remote Supabase project](DEV_TASK_15.yml) | high | low | low | 01, 11, 17 | PENDING | — |
| 16 | 2 | [Make finalize_meeting idempotent](DEV_TASK_16.yml) | medium | medium | medium | — | PENDING | — |
| 17 | 2 | [Remove fake embedding fallback and pin one embedding model](DEV_TASK_17.yml) | medium | medium | medium | — | PENDING | — |
| 18 | 2 | [Make fetch_recent_transcripts non-blocking](DEV_TASK_18.yml) | medium | trivial | low | 17 | PENDING | — |
| 19 | 2 | [Use proactive heuristic only when the LLM is unavailable](DEV_TASK_19.yml) | medium | low | medium | — | PENDING | — |
| 20 | 2 | [Keep the proactive loop alive across per-iteration errors](DEV_TASK_20.yml) | medium | low | low | 19 | PENDING | — |
| 21 | 2 | [Track background tasks via SessionManager.spawn](DEV_TASK_21.yml) | medium | low | medium | 12, 14 | PENDING | — |
| 22 | 2 | [Harden the Playwright renderer](DEV_TASK_22.yml) | medium | high | high | 10 | PENDING | — |
| 23 | 2 | [Evict idle sessions and 404 unknown meetings](DEV_TASK_23.yml) | medium | medium | medium | 12, 21 | PENDING | — |
| 24 | 2 | [Ground the fallback spec template in meeting data](DEV_TASK_24.yml) | medium | low | medium | 16 | PENDING | — |
| 25 | 2 | [Truthful health endpoint and tolerant WebSocket frames](DEV_TASK_25.yml) | low | low | low | 22 | PENDING | — |
| 26 | 2 | [Fail loudly when SessionManager is not configured](DEV_TASK_26.yml) | low | trivial | low | 23 | PENDING | — |
| 27 | 3 | [Consume the spoken phrase once per pinch](DEV_TASK_27.yml) | high | low | medium | 02 | PENDING | — |
| 28 | 3 | [Implement on-demand research mode (ASK_AGENT)](DEV_TASK_28.yml) | high | medium | medium | 02 | PENDING | — |
| 29 | 3 | [Gate canned demo content behind a demoMode input](DEV_TASK_29.yml) | high | medium | medium | 02 | PENDING | — |
| 30 | 3 | [Align Lens pinch actions with the backend contract](DEV_TASK_30.yml) | high | medium | medium | 14, 29 | PENDING | — |
| 31 | 3 | [Show demo data only for the demo meeting](DEV_TASK_31.yml) | high | medium | medium | 07 | PENDING | — |
| 32 | 3 | [Single input path: remove global TapEvent handlers](DEV_TASK_32.yml) | medium | medium | medium | 28, 29, 30 | PENDING | — |
| 33 | 3 | [Replace swallowed catches in Lens scripts with logged errors](DEV_TASK_33.yml) | medium | low | low | 32 | PENDING | — |
| 34 | 3 | 🧑 STEP [LEAF scenarios assert wire payloads and reset state](DEV_TASK_34.yml) | medium | medium | medium | 27, 28, 30 | PENDING | — |
| 35 | 3 | [Paginate transcript fetch in the dashboard](DEV_TASK_35.yml) | medium | low | low | 31 | PENDING | — |
| 36 | 3 | [Guard ensureLayout against cyclic graphs](DEV_TASK_36.yml) | medium | trivial | low | — | PENDING | — |
| 37 | 3 | 🧑 STEP [Decouple dashboard from a Vercel-hosted backend](DEV_TASK_37.yml) | medium | trivial | low | — | PENDING | — |
| 38 | 3 | 🧑 STEP [Configure Lens connection: wss URL, UUID meeting ID, API token](DEV_TASK_38.yml) | medium | low | low | 03, 12, 40 | PENDING | — |
| 39 | 3 | 🧑 GATE [Decide diarization scope; derive speaker badges from data](DEV_TASK_39.yml) | medium | medium | medium | 31 | PENDING | — |
| 40 | 3 | [Prevent duplicate sockets on URL change and reconnect](DEV_TASK_40.yml) | low | low | low | — | PENDING | — |
| 41 | 3 | [Fix raise-hand title formatting and truncation](DEV_TASK_41.yml) | low | low | low | 28 | PENDING | — |
| 42 | 3 | [Prefer explicit style over label keywords in node type detection](DEV_TASK_42.yml) | low | trivial | low | 36 | PENDING | — |
| 43 | 3 | [Compute meeting duration once in the dashboard](DEV_TASK_43.yml) | low | trivial | low | 31 | PENDING | — |
| 44 | 3 | [Extract shared Lens scene-search helpers](DEV_TASK_44.yml) | low | low | low | 33 | PENDING | — |
| 45 | 3 | 🧑 GATE [Resolve NFR-04 whiteboard interaction distance](DEV_TASK_45.yml) | low | trivial | low | — | PENDING | — |
| 46 | 4 | [Extract a shared async LLM helper and delete sync twins](DEV_TASK_46.yml) | medium | high | high | 10, 17, 19, 22, 24 | PENDING | — |
| 47 | 4 | [Single-source node registry with codegen](DEV_TASK_47.yml) | medium | medium | medium | 46, 29, 13 | PENDING | — |
| 48 | 4 | 🧑 STEP [Split SpatialInterfaceManager into focused components](DEV_TASK_48.yml) | medium | high | high | 29, 30, 32, 33, 44 | PENDING | — |
| 49 | 4 | [Remove backend dead code and compat aliases](DEV_TASK_49.yml) | low | low | low | 46, 26, 25 | PENDING | — |
| 50 | 4 | [Split runtime/dev dependencies and pin versions](DEV_TASK_50.yml) | low | low | low | 39 | PENDING | — |
| 51 | 4 | 🧑 STEP [Repo hygiene: ignore previews, drop duplicate texture, triage scripts](DEV_TASK_51.yml) | low | low | low | 08 | PENDING | — |
| 52 | 4 | [Lazy-follow the agent orb instead of head-locking](DEV_TASK_52.yml) | future | low | low | 28 | PENDING | — |
| 53 | 4 | 🧑 STEP [Add HNSW index on knowledge_chunks.embedding](DEV_TASK_53.yml) | future | trivial | low | 15 | PENDING | — |

## Human-required tasks

- **01** (🧑 GATE) Revert permissive RLS migration 002 — APPROVE discarding the uncommitted working-tree edits to supabase/migrations/002_enable_rls.sql before dispatch; Confirm whether the permissive policies were applied to the remote project
- **06** (🧑 HUMAN) Provision SPECSCRIBE_API_TOKEN secrets — Generate and store the token in Cloud Run, GitHub, Vercel and local env files
- **09** (🧑 HUMAN) Rotate Lens Studio MCP token and purge from history — Rotate token in Lens Studio; decide on history rewrite
- **15** (🧑 HUMAN) Apply new migrations to the remote Supabase project — Authorise and run (or approve the agent running) remote migration/policy changes
- **34** (🧑 STEP) LEAF scenarios assert wire payloads and reset state — Run the LEAF suite in Lens Studio Preview and record pass/fail
- **37** (🧑 STEP) Decouple dashboard from a Vercel-hosted backend — Set BACKEND_URL in Vercel project env to the Cloud Run URL
- **38** (🧑 STEP) Configure Lens connection: wss URL, UUID meeting ID, API token — Provide Cloud Run wss URL and set apiToken in Inspector without committing it
- **39** (🧑 GATE) Decide diarization scope; derive speaker badges from data — Choose: implement speaker diarization or remove the claim
- **45** (🧑 GATE) Resolve NFR-04 whiteboard interaction distance — Choose exemption vs reposition
- **48** (🧑 STEP) Split SpatialInterfaceManager into focused components — Wire new components in Scene.scene and verify in Preview
- **51** (🧑 STEP) Repo hygiene: ignore previews, drop duplicate texture, triage scripts — Pick which editor-automation scripts to keep
- **53** (🧑 STEP) Add HNSW index on knowledge_chunks.embedding — Apply migration 006 remotely

## Execution notes

- **Uncommitted user work first.** The branch `feature/lens-app-testing` has uncommitted edits in files many tasks touch (`backend/agents/spec_generator.py`, `SpatialInterfaceManager.ts`, `RaisingHandAgentController.ts`, `SpecScribeDC6Scenario.ts`, `Scene.scene`, `002_enable_rls.sql`). Commit or stash them before `/orchestrate` so each task gets a clean, attributable commit.
- **Migration filenames are reserved** to avoid collisions between parallel workers: `004_timestamp_bigint.sql` (11), `005_embedding_model.sql` (17), `006_knowledge_chunks_hnsw.sql` (53); optional public-read policy from task 01 uses `007_public_read.sql`. Never edit an applied migration.
- **Same-file serialisation.** Dependencies already serialise tasks that share hot files (`backend/main.py`, `session_manager.py`, `raising_hand_agent.py`, `SpatialInterfaceManager.ts`, `web-dashboard/lib/api.ts`). Do not run tasks touching the same file in parallel even if the graph allows it.
- **Lens Studio MCP is offline** in this environment. Lens tasks are verified with `cd spectacles-lens && npm test` (after task 02 makes it truthful); scene/Preview verification is the human step in 34 and 48.
- **Auth rollout order:** 03 → 05 → 06 (secrets) → 38 (Lens token). Local dev can set `SPECSCRIBE_AUTH_DISABLED=1` until 06 is done.
- **Line numbers** in task files come from the 2026-10-25 audit; re-locate by symbol name after earlier tasks shift code.
- Checks: backend `cd backend && pytest -m "not integration" -q`; Lens `cd spectacles-lens && npm test`; dashboard `cd web-dashboard && npx tsc --noEmit && npm run build` (no dashboard test runner exists).

## Open knowledge gaps

- [ ] Was the edited 002 already applied to the remote Supabase project? (check `mcp__supabase__list_migrations` / pg_policies). If yes, task 15 must DROP the permissive policies. (blocks: 01)
- [ ] Is anon public read actually wanted? Fallback: keep only what HEAD already grants. (blocks: 01)
- [ ] Exact include globs needed for Lens Studio .d.ts files — resolve by reading tsconfig.json; fallback: keep include, fix import paths instead (blocks: 02)
- [ ] Does Lens Studio's MCP config support env interpolation in .mcp.json? Fallback: users copy .mcp.example.json to .mcp.json locally. (blocks: 08)
- [ ] Required non-null columns on `meetings` (title?) — read supabase/migrations/001_initial_schema.sql; fallback title 'Live meeting <date>' (blocks: 12)
- [ ] Exact name/signature of the proactive-loop stop method on RaisingHandAgent — read backend/agents/raising_hand_agent.py (blocks: 14)
- [ ] Uncommitted working-tree edits in backend/agents/spec_generator.py — human should commit/stash before dispatch (blocks: 16)
- [ ] Does the export page used by drawio-mcp expose a render promise/callback? Read the evaluate script; fallback: poll for svg element count stability (blocks: 22)
- [ ] Deployed Cloud Run URL — human provides (blocks: 38)
- [ ] Where SCENE_HIERARCHY_SETUP.md lives — locate with glob (blocks: 38)
- [ ] BLOCKING: implement diarization vs remove claim — human must choose (blocks: 39)
- [ ] BLOCKING: option A vs B — human must choose (blocks: 45)
- [ ] BLOCKING for the triage step: list of scripts to keep — human provides (blocks: 51)

## Run log

<!-- orchestrator appends one line per dispatch/verdict -->
