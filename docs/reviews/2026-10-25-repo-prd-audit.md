# Code Audit — Entire repo vs. PRD — 2026-10-25

**Scope:** repo (`backend/`, `spectacles-lens/Assets/Scripts` + `tests/`, `web-dashboard/`, `supabase/migrations/`, deploy/infra config), judged against `PRD.md` v1.1.0 and `docs/prd.md`. Branch `feature/lens-app-testing`; uncommitted working-tree changes included and flagged. The 105 one-off `spectacles-lens/scripts/*.js|ps1` editor-automation scripts were only scanned for secrets and duplication, not reviewed line by line. · **Files reviewed:** 52 · **Findings:** 47 (1 Critical, 10 High, 21 Medium, 12 Low, 3 Info)

**Automated checks run during the audit:** backend `pytest -m "not integration"` gave 29 passed, 1 deselected. Lens `npm test` gave 16/16 passed, but those tests run against stale compiled files and not the current source (see #10).

## Summary Table

| # | Severity | Category | Location | Description |
|---|----------|----------|----------|-------------|
| 1 | Critical | Security: AuthZ | `supabase/migrations/002_enable_rls.sql:12-53` | Uncommitted rewrite gives every role, anon included, INSERT/UPDATE/DELETE on every table |
| 2 | High | Correctness | `backend/graph_engine.py:357-367,405-419` | A real "no change" answer from Gemini, and every Gemini failure, get replaced by a made-up "Whiteboard Ingress" node that is saved and broadcast |
| 3 | High | Security: AuthN/AuthZ | `backend/main.py:181-475` | No authentication on any REST or WebSocket endpoint, and Cloud Run is deployed `--allow-unauthenticated` |
| 4 | High | Correctness: contract | `backend/main.py:387,453` | Proactive interventions are stamped with epoch ms while everything else uses ms since meeting start; this overflows the `integer` column and breaks the timeline |
| 5 | High | Correctness: data loss | `backend/session_manager.py:73-85` | Meetings created over WebSocket never get a `meetings` row, so the FK makes every Supabase insert fail and the failure is swallowed |
| 6 | High | Correctness | `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:42-47,159-162` | A stale ASR phrase is reused as the node label, so the backend's label dedup changes the type of the existing node instead of adding a new one |
| 7 | High | PRD compliance | `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:230-248` | Mode B (ASK_AGENT → RESEARCHING) is not implemented; pinching the IDLE orb shows a hardcoded critique, and the orb never goes back to IDLE |
| 8 | High | PRD compliance | `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:553-716` | The Lens shows pre-baked textures and hardcoded critiques instead of what the backend returns |
| 9 | High | API contract | `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:183,210,676,714` | 4 of the Lens's 5 pinch actions are unknown to the backend; "Conclude Meeting" never calls `/finalize` |
| 10 | High | Testability | `spectacles-lens/tests/components.test.mjs:52-63` | Lens tests import stale `dist/*.js`; the current source would fail them, and a clean CI checkout cannot resolve the imports |
| 11 | High | Correctness: data integrity | `web-dashboard/lib/api.ts:69-81,106-176,193,198` | On any backend error the dashboard shows demo data, canned RAG answers and demo exports under a real meeting's ID |
| 12 | Medium | Security: secrets | `.mcp.json:7` (+103 `spectacles-lens/scripts/*`) | Lens Studio MCP bearer token is committed in 104 files |
| 13 | Medium | Correctness | `backend/agents/decision_linker.py:58-187` | Silently falls back to fake SHA-256 "embeddings" and mixes models with different vector spaces in one pgvector column |
| 14 | Medium | Performance | `backend/agents/decision_linker.py:233-245` | Synchronous Supabase call blocks the event loop inside async `process_snapshot` |
| 15 | Medium | Correctness | `backend/agents/raising_hand_agent.py:225-236` | When Gemini says `trigger=False`, the substring heuristic overrides it and raises the hand anyway |
| 16 | Medium | Error handling | `backend/agents/raising_hand_agent.py:604-640` | One exception stops the proactive loop for the rest of the meeting |
| 17 | Medium | Maintainability: DRY | `backend/agents/*.py`, `backend/graph_engine.py:381` | 13 copies of the model-fallback loop; sync "twin" methods that copy the prompts are mostly dead code |
| 18 | Medium | Correctness | `backend/agents/spec_generator.py:146-170` | The fallback tech spec states architecture that was never discussed (Redis cluster, read replicas) |
| 19 | Medium | Correctness | `backend/agents/spec_generator.py:408-454` | `finalize` is not idempotent and duplicates knowledge chunks already written by DecisionLinker |
| 20 | Medium | Correctness: concurrency | `backend/envelope_router.py:197-214,265-282,313-330` | `asyncio.create_task` is called without keeping a reference: tasks can be GC'd and their exceptions are never seen |
| 21 | Medium | Resilience | `backend/graph_engine.py:315-343` | Renderer takes the screenshot without waiting for the render to finish, has no timeout, uses one global page/lock, and never recovers after a crash |
| 22 | Medium | SOLID: OCP | `backend/graph_engine.py:53` | Node types are still hardcoded outside the registry (Literal type, Lens if-chains), and the registry exists in three hand-synced copies |
| 23 | Medium | Performance / DoS | `backend/session_manager.py:50-85` | Unbounded in-memory sessions/stores; any unauthenticated meeting ID creates state that is never freed |
| 24 | Medium | PRD compliance | `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:166` | No speaker diarization (speaker label is hardcoded); `deepgram-sdk` is a dependency but never used |
| 25 | Medium | SOLID: SRP | `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:1-905` | 905-line class doing input, calibration, palette, demo state machine, audio and collider config |
| 26 | Medium | Correctness | `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:247-267` | Two global `TapEvent` handlers both act on one tap (orb toggle and node add) |
| 27 | Medium | Error handling | `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:94,242,264,363,464,494,709,854,871` (+ more) | Swallowed exceptions (`catch (e) {}`) all over the Lens scripts hide wiring and asset failures |
| 28 | Medium | Testability | `spectacles-lens/Assets/Scripts/SpecScribeDC3Scenario.ts:147-184` | LEAF scenarios only check local demo counters, never the wire payload; they depend on order and share state |
| 29 | Medium | Deployment | `vercel.json:3-19` | Dashboard is bound to a FastAPI Vercel service that cannot host WebSockets, Playwright or in-memory state |
| 30 | Medium | Security: input validation | `web-dashboard/app/api/meetings/[id]/ask/route.ts:21-24` | Meeting ID is put into the backend proxy URL without encoding, allowing path traversal |
| 31 | Medium | Correctness | `web-dashboard/lib/api.ts:35-67` | Dashboard ignores the backend's pagination, so transcripts silently stop at 100 turns |
| 32 | Medium | Correctness | `web-dashboard/lib/xmlParser.ts:198-208` | `ensureLayout` loops forever on cyclic graphs that have no geometry, freezing the tab |
| 33 | Low | Maintainability: dead code | `backend/main.py:83-123` | Backward-compat aliases, write-only `_last_intervention_time`, unused `_sync` wrapper, monkey-patching of a third-party module |
| 34 | Low | API design | `backend/main.py:181-195` | `/api/health` reads private attributes and always reports the agents as `True` |
| 35 | Low | API design | `backend/main.py:284-291` | Timeline returns 200 with a made-up title for meeting IDs that don't exist |
| 36 | Low | Resilience | `backend/main.py:458-469` | A JSON message that isn't an object, or a binary frame, closes the WebSocket |
| 37 | Low | Dependency hygiene | `backend/requirements.txt:1-15` | Version ranges are open-ended; test-only tools ship in the runtime image; one dependency is unused |
| 38 | Low | Error handling | `backend/session_manager.py:172-199` | Fallback quietly builds a fresh, empty `SessionManager` |
| 39 | Low | Correctness | `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:61-67` | `setWebsocketUrl` leaves the old socket's handlers bound, which can create duplicate sockets |
| 40 | Low | Correctness | `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:187-203,427-441` | Emoji gets prefixed twice; `substring(0,28)` can cut an emoji in half; the logic is copied in two places |
| 41 | Low | Maintainability: DRY | `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:136-162` | Scene-search helpers and the duration calculation are duplicated (and inconsistent) |
| 42 | Low | PRD: NFR-04 | `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:134` | Whiteboard interactable sits at 2.3 m, outside the 1.0–1.3 m interaction band |
| 43 | Low | Correctness | `web-dashboard/lib/xmlParser.ts:130-141` | Label keywords win over explicit style: "Backend API" renders as a terminal ellipse |
| 44 | Low | Repo hygiene | repo root (25 untracked files) | Preview screenshots, a duplicate texture `"… 2.png"`, and 105 one-off scripts |
| 45 | Info | Spatial UX | `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:276-286` | Orb is locked to the head (re-parented every frame) instead of following lazily |
| 46 | Info | Performance | `supabase/migrations/001_initial_schema.sql:56-66` | No HNSW/IVFFlat index on `knowledge_chunks.embedding` |
| 47 | Info | Configuration | `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:6` | Default `ws://localhost:…/demo-session-01` only works in Preview |

_Sorted by severity (Critical first), then by file._

## Findings

### #1 — [Critical] Security: AuthZ — `supabase/migrations/002_enable_rls.sql:12-53` (UNCOMMITTED)

**What:** The working-tree version replaces the committed `auth.role() = 'service_role'` policies with policies that have no role restriction:
```sql
CREATE POLICY "Service and authenticated delete for meetings" ON meetings
  FOR DELETE USING (true);
CREATE POLICY "Service and authenticated update for agent_interventions" ON agent_interventions
  FOR UPDATE USING (true);
```
There is no `TO authenticated` clause, so the policies apply to `PUBLIC`, which includes `anon`. The policy names say "Service and authenticated", but that is not what they do. The backend uses the service key, which bypasses RLS anyway, so these policies only ever grant access to anonymous and browser callers.

**Why:** The Supabase anon key is public by design. With it, anyone can `DELETE FROM meetings`, and through `on delete cascade` that wipes every transcript, snapshot, intervention and embedding, or rewrites any meeting's spec and diagram. The change also edits migration `002` in place. If `002` has already been applied to the remote project, the new text never runs, and the repo no longer describes the live database.

**Fix:** Revert to the committed version (`git checkout HEAD -- supabase/migrations/002_enable_rls.sql`). If public read is really wanted, add it in a new migration `004_*.sql` containing only `FOR SELECT TO anon USING (true)`, and keep all writes restricted to `service_role`. Never edit applied migrations; add new ones.

### #2 — [High] Correctness — `backend/graph_engine.py:357-367,405-419`

**What:** If Gemini answers that nothing changed (`has_meaningful_change=False`, no vertices or edges), line 408 skips the parsed result and execution falls through to:
```python
return GraphDeltaSchema(has_meaningful_change=True,
    added_vertices=[VertexAddition(temp_id="v-auto", label="Whiteboard Ingress", node_type="service")], ...)
```
The same invented delta is returned on any exception or empty response. When no API key is set, the result is `"Whiteboard Node"`.

**Why:** Every frame that passes the pHash gate (which includes lighting changes and head movement) now adds a node nobody drew. `CameraFrameHandler` (`envelope_router.py:170-214`) then saves a `VISION_DIFF` snapshot, broadcasts it to the AR overlay, and starts the DecisionLinker and RaisingHand agents on invented data. This undermines the core promise of US-01, a diagram that reflects the whiteboard.

**Fix:** Return `parsed` whenever it validates. On failure, or when there is no key, return `GraphDeltaSchema(person_occluding_board=False, has_meaningful_change=False, added_vertices=[], added_edges=[], diff_summary="")`. `CameraFrameHandler` already skips on `has_meaningful_change=False`. If a demo fallback is needed, put it behind an explicit `SPECSCRIBE_DEMO_MODE` flag.

### #3 — [High] Security: AuthN/AuthZ — `backend/main.py:181-475`, `.github/workflows/deploy.yml:155`

**What:** None of `/api/meetings*`, `/finalize`, `/ask`, `/proactive-critique` or `/ws/meeting/{id}` checks any credential, and Cloud Run is deployed with `--allow-unauthenticated`. The meeting ID is the only access control.

**Why:** Anyone who knows or guesses a meeting ID can read its full transcripts (`/timeline`) and can inject transcript turns, nodes and fake critiques into a live meeting over the WebSocket, which then reach the wearer's AR view. Unlimited calls to `/ask`, `/finalize` and `/proactive-critique` spend the project's Gemini quota (cost abuse, CWE-770). This combines with #1 and #23.

**Fix:** Require a bearer token on every route. For the hackathon, a shared `SPECSCRIBE_API_TOKEN` checked by a FastAPI dependency is enough; the WebSocket can take it as `?token=` checked before `accept()`. Have the Next.js proxy add the token server-side. Add per-IP rate limiting (for example `slowapi`) to the Gemini-backed POST routes.

### #4 — [High] Correctness: contract — `backend/main.py:387,453`, `backend/agents/raising_hand_agent.py:610`

**What:** Every other producer sends `timestamp_ms` as an offset from meeting start (Lens `getElapsedMs()`; PRD §5 and schema comment "Offset from meeting start"). The proactive paths use the wall clock instead:
```python
get_timestamp_fn=lambda mid: int(datetime.now(timezone.utc).timestamp() * 1000),  # main.py:453
ts = int(datetime.now(timezone.utc).timestamp() * 1000)                           # main.py:387
```

**Why:** About 1.76e12 is more than `integer`'s 2,147,483,647 limit, so every proactive `agent_interventions` insert fails and is swallowed (`raising_hand_agent.py:508`). In memory-store mode the record is kept: the dashboard's `totalDurationMs` (`app/meetings/[id]/page.tsx:59`) becomes about 55 years, and every marker shrinks into the first pixel of the scrubber. `_get_recent_context` also filters turns between epoch−60 s and epoch, which matches nothing, so it falls back to the "last 5 turns" path.

**Fix:** Keep a per-session `started_at_monotonic` (set when the first WebSocket connects, or taken from the handshake) and expose `session.elapsed_ms()`. Use it in both places. Widen the columns to `bigint` in a new migration so a future wrong value fails loudly instead of overflowing.

### #5 — [High] Correctness: data loss — `backend/session_manager.py:73-85,120-128,158-167`

**What:** `get_or_create_session` puts the meeting row only in `memory_store["meetings"]`. Only `POST /api/meetings` inserts into Supabase. A Lens connecting to `/ws/meeting/<id>` never creates the parent row. The Lens default ID `demo-session-01` (`PersistentStreamSocketClient.ts:6`) is also not a UUID, while `meeting_id` is `uuid references meetings(id)` (`001_initial_schema.sql:16`).

**Why:** With Supabase configured, every `transcript_turns`, `diagram_snapshots`, `agent_interventions` and `knowledge_chunks` insert for a live session fails the FK or uuid cast. Each failure is logged at WARNING and ignored. The whole meeting exists only in process memory and is lost on restart or redeploy, and Cloud Run `--min-instances=1` does not guarantee the instance survives. This breaks US-04 (post-meeting review).

**Fix:** In `get_or_create_session`, validate `meeting_id` as a UUID (`uuid.UUID(meeting_id)`; reject the WebSocket with code 4400 otherwise) and upsert the `meetings` row (`on_conflict="id"`). Change the Lens default to a UUID taken from config or a QR code. Raise persistence failures as an `ERROR` metric, not a warning.

### #6 — [High] Correctness — `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:42-47,159-162`; `backend/graph_engine.py:129-139`

**What:** `latestSpokenPhrase` is overwritten by every partial ASR update and never cleared once used. When there has been no speech, `getLatestSpokenPhrase()` always returns the constant `'Payment Gateway Microservice'`. On the backend, `add_node` deduplicates by lowercase label and *re-styles the existing cell*:
```python
if lower_label in self.node_by_label:
    ... c.style = style; return existing_id
```
`node_metadata[...]["type"]` is also left stale.

**Why:** In the Lens Studio Preview, which the PRD makes the mandatory judging target, pinching Decision, then Service, then Database, then Terminal produces **one** node whose shape flips each time, instead of four nodes. US-02 ("pinch … and speak a node name") fails under normal use. Even with real ASR, two pinches without speaking in between change the type of the previous node.

**Fix:** In the Lens, take the phrase on pinch and then clear it (`consumeLatestSpokenPhrase()`), or require a final transcript newer than the last pinch. If none exists, send no label and let the backend generate `f"{prefix} {n}"`. On the backend, only dedupe when the type also matches, update `node_metadata` when re-styling, and report "updated" vs "added" correctly in `diff_summary`.

### #7 — [High] PRD compliance — `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:230-248`

**What:** PRD T-13 and US-03 require: if the orb is IDLE, capture the spoken query and send `ASK_AGENT`, and show RESEARCHING. The code does this instead:
```ts
} else if (this.currentState === AgentState.IDLE) {
  // Simulate proactive insight trigger in preview
  this.setVisualState(AgentState.HAND_RAISED, '⚠️ Auth Token Leak Risk', '• Risk: ...');
```
`socketClient` is never used to send anything, nothing ever sets `RESEARCHING`, and nothing returns the orb to `IDLE` after `HAND_RAISED`, so a second pinch only toggles the card. `docs/spec.md:480-481` documents the correct behaviour, which the code no longer has.

**Why:** On-Demand Research Mode, one of the two named modes of the flagship "Raising-Hand" feature, does not exist on the client. The backend's working `ASK_AGENT` handler (`envelope_router.py:346-355`) can never be reached from the Lens. Once raised, the orb stays raised for the rest of the session.

**Fix:** In the IDLE branch, call `setVisualState(RESEARCHING, '🔍 Researching...', '')` and then `socketClient.sendPinchCommand('ASK_AGENT', 'research', socketClient.getLatestSpokenPhrase())`. In the HAND_RAISED branch, the second pinch (card already open) should go back to `IDLE`. This matches the existing test at `tests/components.test.mjs:485-535`.

### #8 — [High] PRD compliance — `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:553-716`

**What:** `triggerAddNode` swaps the overlay to the pre-rendered `Diagram_NodeAdded_1024x683.png`, falls back to hardcoded labels (`'Redis Token Cache'`, `'Enforce JWT HMAC Verification'`), and calls `raisingHandAgent.triggerHandRaised(...)` with a canned critique for each node type (lines 603-629). `triggerUpdateSnapshot` shows the toast "Redis cache reduces DB load by 42%". `startDrawingAndIngestion` claims "4 nodes, 3 edges" without asking the server.

**Why:** The AR overlay and the hand raises the wearer sees come from the client script, not from the drawio-mcp pipeline or the RaisingHand agent the PRD describes (US-01 to US-03). The real `DIAGRAM_UPDATED` texture then arrives later and overwrites the canned one, so what is shown depends on network timing. The demo video would be showing a scripted mock while the write-up describes live AI. That is a risk for the "Technical Implementation" (25%) and "Utility" judging criteria.

**Fix:** Put the canned flow behind an explicit `@input demoMode: boolean` (default `false`). When it is off, the palette only sends `ADD_NODE`. The overlay changes only in `onDiagramUpdated`, and hand raises come only from `onHandRaised`. A small "pending" toast can stand in for the round trip.

### #9 — [High] API contract — `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:183,210,676,714` vs `backend/envelope_router.py:357-366`

**What:** The Lens sends `CALIBRATE_AREA`, `INGEST_DRAWING`, `UPDATE_SNAPSHOT` and `CONCLUDE_MEETING`. The backend only understands `ADD_NODE`, `CONNECT_NODES` and `ASK_AGENT`, and answers each of the others with `COMMAND_ERROR "Unrecognized pinchCommand action"`. `triggerConcludeMeeting` shows "Technical Spec Generated", but nothing ever calls `POST /api/meetings/{id}/finalize`, and the proactive loop keeps running.

**Why:** Four of the five pinch actions the Lens sends are rejected, so every demo run fills the logs with errors (against NFR-01, "zero console warnings"). The end-of-meeting step the PRD depends on (T-09: spec generation and embedding for RAG) never happens from the device, so the dashboard's RAG has nothing to search unless someone runs `/finalize` by hand.

**Fix:** Write the action enum once in `docs/spec.md` and in shared constants. Add a `CONCLUDE_MEETING` backend handler that calls `spec_generator.finalize_meeting` and `raising_hand_agent.stop_proactive_loop`, then pushes a `MEETING_FINALIZED` event. Stop sending the client-only actions, or handle them as no-ops that are acknowledged.

### #10 — [High] Testability — `spectacles-lens/tests/components.test.mjs:52-63`, `spectacles-lens/tsconfig.build.json:4`, `spectacles-lens/package.json:9`

**What:** `npm test` runs `tsc -p tsconfig.build.json`. Because `include` spans `Assets/`, `Packages/` and `Cache/`, output goes to `dist/Assets/Scripts/*.js` (checked: written today at 16:09). The tests import `../dist/RaisingHandAgentController.js` and friends, which are **stale files from Oct 20**. The stale file contains `sendPinchCommand('ASK_AGENT'...)`; the current source has no `ASK_AGENT` at all (#7), and the "ASK_AGENT … transitions to RESEARCHING" test still passes. `dist/` is gitignored.

**Why:** The 16 green Lens tests check code that no longer exists, so they give false confidence about T-10 to T-13. On a clean CI checkout (`deploy.yml:83-86`), `../dist/*.js` is missing, so the job fails with `ERR_MODULE_NOT_FOUND`. That blocks deploys, or someone "fixes" it by committing stale build output.

**Fix:** Point the imports at `../dist/Assets/Scripts/<Name>.js`, or set `rootDir: "./Assets/Scripts"` and `include: ["./Assets/Scripts/**/*.ts", <decl globs>]` in `tsconfig.build.json`. Add `rm -rf dist` before the build (`"pretest": "node -e \"fs.rmSync('dist',{recursive:true,force:true})\""`). Expect #7's test to fail until the fix there lands.

### #11 — [High] Correctness: data integrity — `web-dashboard/lib/api.ts:69-81,106-176,193,198`; `web-dashboard/app/api/meetings/[id]/timeline/route.ts:37-46`; `.../ask/route.ts:39-41`; `web-dashboard/app/meetings/[id]/page.tsx:21`

**What:** Any backend error, timeout or non-2xx response returns `DEMO_TIMELINE` relabelled with the real meeting ID (`title: "Meeting xxxx: Architecture Review"`). `askMeetingRAG` returns hardcoded paragraphs about Redis and Kafka, with made-up `[00:36]` citations, for *any* meeting whose question contains "cache", "risk", "agent", "event" and so on. The exports fall back to `DEMO_TIMELINE.meeting.latest_drawio_xml` and the demo spec. The page also starts on `DEMO_TIMELINE`, so demo data shows while loading. On the server, `ask/route.ts` calls `askMeetingRAG`, which calls the backend a second time before falling back.

**Why:** A reviewer, the US-04 persona, cannot tell real meeting data from invented data. They can export a demo `.drawio` file and spec as the record of their own meeting, and get confident, cited answers about decisions that were never made. Silent substitution also hides every backend outage.

**Fix:** Use demo data only when `id === DEMO_MEETING_ID`. Otherwise show an error state ("Backend unavailable — retry") and return `502` from the route handlers. Remove the keyword-canned answers, or limit them to the demo ID. Exports should be disabled when the field is missing. Initial state should be `null` plus a loading skeleton.

### #12 — [Medium] Security: secrets — `.mcp.json:7`, `spectacles-lens/scripts/mcp_call.js:10` (+102 other scripts)

**What:** `Authorization: Bearer <redacted>…` is committed in `.mcp.json` and copied into 103 files under `spectacles-lens/scripts/`.

**Why:** The hackathon rules require a public repo. The token protects the local Lens Studio MCP server (`localhost:50040`). That server can run arbitrary editor code (`ExecuteEditorCode`), so any local process or browser page that reaches the port with this token can control the editor. Copying it 103 times also means rotating it means editing 104 files.

**Fix:** Rotate the token in Lens Studio. Read it from `process.env.LS_MCP_TOKEN` in a single `scripts/lib/mcpClient.js` that all scripts import, add `.mcp.json` to `.gitignore` (commit `.mcp.example.json`), and remove it from history if the repo is already public.

### #13 — [Medium] Correctness — `backend/agents/decision_linker.py:58-187`

**What:** (a) On any embedding error the code stores `generate_deterministic_embedding` vectors (SHA-256 bytes repeated) into pgvector with no marker. (b) The fallback model `text-embedding-004` returns 768 dimensions, which `_normalize_embedding_dim` pads with 1536−768 zeros, in the same column as `gemini-embedding-001` vectors.

**Why:** Cosine similarity between vectors from different models, or against hash noise, means nothing. A short outage during `/finalize` permanently fills `knowledge_chunks` with garbage, and `match_knowledge_chunks` returns it as grounded RAG evidence. Nothing in the data tells you which rows are bad.

**Fix:** Pin one embedding model (and store its name in a new `embedding_model text` column). On failure, raise or skip persisting so the caller can retry, rather than writing fake vectors. Keep deterministic vectors only behind an explicit test or offline flag.

### #14 — [Medium] Performance — `backend/agents/decision_linker.py:233-245`

**What:** `fetch_recent_transcripts` calls `self.supabase_client.table(...).execute()` synchronously. It is called from `async process_snapshot` (line 422) whenever the memory store has no turns for the meeting, for example after a restart.

**Why:** Each call is a blocking HTTPS round trip on the event loop, which stalls every WebSocket and request during the vision path. This brings back the problem finding #1 of the 10-17 audit fixed everywhere else.

**Fix:** Make it `async` and wrap the call in `await asyncio.to_thread(...)`, as `session_manager.py:122` does.

### #15 — [Medium] Correctness — `backend/agents/raising_hand_agent.py:225-236,106-155`

**What:** If Gemini answers `trigger=False`, or repeats an earlier title, execution falls through to `_evaluate_heuristic_proactive`. That heuristic triggers on substrings of the raw XML plus the transcript: `"cache"`, `"database"`, and `"auth"`/`"token"` when `"rate"` does not appear anywhere (`"rate"` also matches "generate", "integrate", "separate").

**Why:** With a working LLM, the agent still raises its hand on keyword matches every 20 seconds, until all three canned titles have been used. The "high-severity only" constraint in the prompt (line 198) is overridden. False positives on a peripheral AR alert are exactly the distraction US-03 says to avoid.

**Fix:** Use the heuristic only when `self._genai_client is None` or the call raised. If Gemini returns `trigger=False`, return that evaluation. Match whole words (`re.search(r"\brate[- ]?limit", ...)`) if the heuristic stays.

### #16 — [Medium] Error handling — `backend/agents/raising_hand_agent.py:604-640`

**What:** The `try` wraps the whole `while True`. A single exception from `get_diagram_fn`, `persist_and_broadcast` or similar exits the loop for good. Telemetry is set to `"degraded"`, but the loop is only restarted when a *new* WebSocket connects (`main.py:448`).

**Why:** Proactive Critique Mode silently stops for the rest of the meeting after one transient error, and `/api/health` reports "degraded" without recovering.

**Fix:** Move the `try/except Exception` inside the loop body around one iteration, log it with `exc_info=True`, increment `error_count`, and `continue`. Keep `CancelledError` outside so it still ends the loop.

### #17 — [Medium] Maintainability: DRY — `backend/agents/decision_linker.py:76,117,161,298,378`, `raising_hand_agent.py:204,278,345,446`, `spec_generator.py:229,305,687`, `graph_engine.py:381`

**What:** The `candidate_models = [...]; configured_model = os.environ...; for model_name in ...: try ... except: logger.debug` block appears 13 times. Each agent also has a sync twin (`evaluate_proactive`, `evaluate_research_pull`, `synthesize_rationale`, `compile_markdown_spec`) that copies the prompt word for word and calls the blocking client; outside tests these have 0 to 1 callers. Failures are logged at DEBUG, so they don't show at the default INFO level. No call sets a timeout.

**Why:** Prompt fixes already have to be made twice per agent. Changing the model list, adding a timeout or adding a retry policy means 13 edits, and the copies will drift. Hiding failures at DEBUG makes fallback-to-heuristic invisible in production.

**Fix:** Extract `backend/llm.py` with `async def generate_structured(prompt, schema=None, contents=None) -> Optional[str]` that owns the model list, `asyncio.wait_for(..., timeout=...)`, one shared `genai.Client`, and WARNING-level logging. Delete the sync twins and update the tests to `await` the async methods.

### #18 — [Medium] Correctness — `backend/agents/spec_generator.py:146-170`

**What:** The deterministic template, used whenever Gemini is unavailable, always says "Relational database with read-replica clustering", "Deploy Redis cluster with request coalescing", "Configure PostgreSQL primary with cross-AZ read replica", whatever the meeting actually contained.

**Why:** The generated spec, exported as "Verified Artifacts" (`TopBar.tsx:139`), states decisions that were never made. It is also chunked into `TECH_SPEC` RAG chunks (lines 392-404), so the RAG then "confirms" the invented content.

**Fix:** Build sections 1, 2 and 6 only from the inputs: list node labels by type from `drawio_xml`, and turn `agent_interventions` into action items. When there is no data, say "No data recorded".

### #19 — [Medium] Correctness — `backend/agents/spec_generator.py:344-355,408-454`; `backend/agents/decision_linker.py:459-480`

**What:** `DecisionLinkerAgent.process_snapshot` already inserts a `DECISION` chunk for each snapshot. `finalize_meeting` then creates another `DECISION` chunk for every snapshot, and each further call to `/finalize` `extend`s/`insert`s a complete new set again.

**Why:** RAG top-k results fill up with near-duplicate chunks, pushing out other evidence, and storage grows by a full set on each finalize. This becomes likely once #9 wires finalize to the conclude button, which can be pinched more than once.

**Fix:** Before inserting, delete the existing chunks (`delete().eq("meeting_id", id).in_("chunk_type", ["DECISION","TRANSCRIPT_WINDOW","AGENT_INSIGHT","TECH_SPEC"])`) and replace the memory list. Alternatively, skip the DECISION chunks in `chunk_meeting_artifacts`, since the linker already made them.

### #20 — [Medium] Correctness: concurrency — `backend/envelope_router.py:197-214,265-282,313-330`

**What:** `asyncio.create_task(session_mgr.decision_linker.process_snapshot(...))` is called six times and the result is thrown away.

**Why:** The asyncio docs warn that the loop holds only weak references, so a pending task can be garbage-collected mid-run. Any exception becomes "Task exception was never retrieved" at GC time. Nothing cancels these tasks on shutdown.

**Fix:** Add `SessionManager.spawn(coro)`, which adds the task to `self._bg_tasks: set`, calls `task.add_done_callback(self._on_bg_done)` (log exceptions, then discard), and cancels the set in `lifespan` shutdown.

### #21 — [Medium] Resilience — `backend/graph_engine.py:315-343`

**What:** (a) `page.evaluate` calls `window.render(...)` and returns straight away. The SVG screenshot is taken without waiting for any "render complete" signal, unlike the PRD blueprint's polling with a deadline (PRD §6.1). (b) There is no timeout on `evaluate` or `screenshot` (Playwright's default is 30 s) while the global `_lock` is held. (c) One page is shared by all meetings. (d) If Chromium crashes, `_is_ready` stays `True` and every later render raises, with no restart.

**Why:** Without a completion signal the screenshot can capture the *previous* diagram, which streams the wrong overlay. One slow render blocks every meeting's pinch path for up to 30 s, far beyond the 140 ms NFR-02. A crash takes down rendering until the process is redeployed.

**Fix:** Wait for a render-complete marker (`await page.wait_for_function("() => document.querySelector('svg') && window.__renderDone === true", timeout=500)`; set the flag in the evaluate promise). Wrap the whole render in `asyncio.wait_for(..., 2.0)`. On `playwright` `Error` or `TargetClosedError`, set `_is_ready=False` and schedule `await self.stop(); await self.start()`. Consider a small page pool.

### #22 — [Medium] SOLID: OCP — `backend/graph_engine.py:53`, `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:578-628`, `backend/node_registry.py`, `web-dashboard/lib/nodeRegistry.ts`, `spectacles-lens/Assets/Scripts/NodeRegistry.ts`

**What:** The registry refactor from the 10-17 audit (#10) left type dispatch in several places: `node_type: Literal["service","decision","database","terminal"]` in the Gemini schema, the Lens `if (nodeType === 'service') … else if …` chains for labels and critiques, and the three registries themselves, which are kept in sync by hand in Python and TypeScript.

**Why:** Adding a `queue` node type still means editing 5+ places in 3 codebases. If any copy is missed, the Gemini schema rejects the new type, or `add_node` silently converts it to `service` (`graph_engine.py:123-124`).

**Fix:** Generate the TypeScript registries from one `node_registry.json` (a small build script), and build the Literal dynamically: `NodeTypeLiteral = Literal[tuple(NODE_REGISTRY)]`. Move the Lens per-type labels and critiques into `LENS_NODE_REGISTRY` entries. Removing the canned critiques entirely, per #8, is better still.

### #23 — [Medium] Performance / DoS — `backend/session_manager.py:50-85`; `backend/main.py:385,415`

**What:** `live_sessions`, `memory_store[*]`, `raising_hand_agent._history` and `_last_intervention_time` are never evicted. `get_or_create_session` runs for any meeting ID on `POST /proactive-critique`, `POST /finalize` and WebSocket connect.

**Why:** Combined with #3, a loop of requests with random UUIDs grows memory until the 2 GiB Cloud Run instance hits OOM. Because state lives only in process memory, that also deletes every live meeting (#5).

**Fix:** Return 404 for unknown meetings on REST routes. Add idle-TTL eviction, for example in the WebSocket `finally` block when the last socket leaves, plus a periodic sweep. Cap the number of sessions.

### #24 — [Medium] PRD compliance — `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:166`; `backend/requirements.txt:6`; `web-dashboard/components/TopBar.tsx:100-114`

**What:** Every transcript turn is sent as `speaker_label: 'Speaker 0 (Wearer)'`. `deepgram-sdk` is a dependency and `DEEPGRAM_API_KEY` is deployed, but no code imports it. The dashboard's speaker badges are the hardcoded "Speaker 0 (Ruan)" and "Speaker 1 (Architect)".

**Why:** "Speaker-diarized transcripts" and "*which speaker* advocated" (PRD §1.1, §1.2-4, US-04) are core value claims. DecisionLinker's "WHO proposed it" can only ever name the wearer, and the dashboard shows people who may not be in the meeting.

**Fix:** Either implement diarization (send PCM to Deepgram from the backend, or use AsrModule speaker info if available) or remove the claim from the docs and Devpost write-up. Build the badges from `distinct(transcript_turns.speaker_label)`. Remove `deepgram-sdk` until it is used.

### #25 — [Medium] SOLID: SRP — `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:1-905`

**What:** One component handles texture loading, scene search, collider setup, SIK binding, touch-drag, keyboard and tap input, whiteboard calibration, a 6-state demo state machine, canned critique content, audio playback and socket callbacks.

**Why:** Each demo tweak touches this file (it is modified in the working tree right now). The state machine cannot be tested without mocking SIK, textures and the scene graph, which is why the tests only check counters (#28). The per-feature changes keep colliding.

**Fix:** Split it into `WhiteboardCalibrator` (drag, resize, lock), `PaletteController` (4 buttons → `sendPinchCommand`), `DiagramOverlayView` (texture setting) and `PreviewInputAdapter` (touch, keyboard, tap). Keep `SpatialInterfaceManager` as a thin composition root. This adds indirection, which is worth it here because each piece has a different reason to change.

### #26 — [Medium] Correctness — `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:247-267`; `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:390-402`

**What:** Both components bind a global `TapEvent`. In DRAWING or NODE_ADDED state, the SpatialInterfaceManager handler adds a node on *any* tap. The agent handler toggles the orb on taps in the top-right area. Neither checks whether the other has handled the tap, and neither checks whether an SIK Interactable was hit.

**Why:** In the Preview, tapping the orb also adds a node, and that node triggers another canned hand raise (#8). A tap on a palette button can also add two nodes (TapEvent plus `onTriggerEnd`). This makes the demo unpredictable on camera.

**Fix:** Remove the global `TapEvent` handlers and rely on SIK Interactables, which already work in the Preview. If a preview shortcut is still wanted, keep a single `PreviewInputAdapter` (#25) that does a hit test and dispatches exactly one action.

### #27 — [Medium] Error handling — `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:94,242-244,264-266,363-365,464-466,494-496,709-711,854-856,871-873`; `RaisingHandAgentController.ts:64,89-91,146-148,170-172,224-226,360,386,402,412`; `PersistentStreamSocketClient.ts:84-86,190-192,232-240`

**What:** There are 25+ `catch (e) { /* Ignored */ }` or `catch (e) {}` blocks, around texture assignment, component lookup, audio, collider config and event binding.

**Why:** A missing material, a renamed SceneObject or a failed `requireAsset` produces a Lens that silently does nothing, with no log line to debug from. This only meets NFR-01 ("zero console warnings") on paper, by hiding problems instead of preventing them.

**Fix:** Replace these with `catch (e) { print(\`[Component] <operation> failed: ${e}\`) }` at minimum. Fail loudly at `OnStartEvent` when a required `@input` cannot be resolved. Keep silent catches only for feature detection that is truly optional (such as `KeyPressEvent`), and give those a comment explaining why.

### #28 — [Medium] Testability — `spectacles-lens/Assets/Scripts/SpecScribeDC3Scenario.ts:147-184`, `SpecScribeDC6Scenario.ts:103-116`, `SpecScribeTestHelpers.ts:5-27`

**What:** The LEAF scenarios check `getNodeCount()` and `getDiagramStage()`, which are local demo counters (`nodeCount = 4` is hardcoded at `SpatialInterfaceManager.ts:193,564`). They never check the `pinchCommand` payload or any backend effect. DC6 sets `meetingConcluded=true`, which is never reset, so running DC3 after DC6 in the same session fails because `triggerAddNode` returns early.

**Why:** The scenarios pass while #6, #7 and #9 are broken, so the bugs that matter here go undetected. Order dependence makes suite reruns flaky.

**Fix:** Inject a fake socket in the scenarios (or expose `getLastSentCommand()`) and assert `{action:'ADD_NODE', node_type:'decision', label:…}`. Add a `resetForTest()` that the LEAF runner calls before each scenario.

### #29 — [Medium] Deployment — `vercel.json:3-19`

**What:** `vercel.json` deploys `backend/` as a Vercel FastAPI service and binds `BACKEND_URL` for the dashboard to it, while `deploy.yml` deploys the same backend to Cloud Run.

**Why:** Vercel Functions cannot hold a WebSocket server, run Playwright Chromium, or keep `memory_store` between invocations. On Vercel, the dashboard's `BACKEND_URL` points at an instance whose timeline is always empty or errors, which triggers the demo-data substitution in #11. There are two sources of truth for where the backend lives.

**Fix:** Remove the `backend` service from `vercel.json` and set `BACKEND_URL` to the Cloud Run URL in the Vercel project env.

### #30 — [Medium] Security: input validation — `web-dashboard/app/api/meetings/[id]/ask/route.ts:21-24`, `.../timeline/route.ts:22-25`, `web-dashboard/lib/api.ts:53,90`

**What:** `new URL(\`api/meetings/${id}/ask\`, backendBase)` uses the route param after decoding and without encoding. With `id = "..%2F..%2Fhealth%3F"` the URL resolves to `/api/health?/ask`, and `..` segments are normalized away.

**Why:** The public dashboard becomes a proxy to any GET or POST path on the internal backend under the bound service URL, which gets past any network-level restriction meant to keep the backend private.

**Fix:** Validate first: `if (!/^[0-9a-f-]{36}$|^demo(-session-01)?$/i.test(id)) return 400`. Then build the URL with `encodeURIComponent(id)`, and do the same in `lib/api.ts`.

### #31 — [Medium] Correctness — `web-dashboard/lib/api.ts:35-67`; `backend/main.py:237,299-302`

**What:** The backend paginates `transcript_turns` (default `limit=100`) and returns `pagination.has_more`. `getMeetingTimeline` is called without options and never reads `has_more`.

**Why:** In any meeting with more than 100 utterances (about 10 minutes of talk), the transcript, the scrubber's active-turn highlight and the client-side RAG fallback silently stop at turn 100, which defeats US-04.

**Fix:** In `getMeetingTimeline`, loop while `pagination.has_more` (`offset += limit`) and concatenate. Alternatively, lazy-load windows with `from_ms`/`to_ms` as the scrubber moves.

### #32 — [Medium] Correctness — `web-dashboard/lib/xmlParser.ts:198-208`

**What:**
```ts
if (layer[next] === undefined || layer[next] <= currLayer) { layer[next] = currLayer + 1; queue.push(next); }
```
On any cycle (A→B→A), the layer numbers keep increasing and the queue never empties.

**Why:** It is only reached when every vertex has 0,0 geometry (for example hand-edited, imported, or LLM-produced XML), but then the browser tab freezes with no way to recover. Vision deltas can create feedback edges.

**Fix:** Cap it: `if (layer[next] === undefined || (layer[next] <= currLayer && currLayer < vertices.length))`, or keep a visited count per node, or compute layers on a DAG after removing back-edges with a DFS.

### #33 — [Low] Maintainability: dead code — `backend/main.py:83-123`, `backend/agents/raising_hand_agent.py:59,513`, `backend/graph_engine.py:98-100,422-445`

**What:** Module-level aliases and wrappers kept only so tests can import them (`live_sessions`, `db_save_*`, `get_or_create_session`). `_last_intervention_time` is written but never read. `extract_graph_delta_from_gemini_sync` has 0 callers and uses the deprecated `get_event_loop()`. `setattr(drawio_mcp.layout_engine, "LayoutEngine", ...)` monkey-patches a third-party module.

**Why:** It keeps the ambient global state that the 10-17 DIP finding was supposed to remove, and the monkey-patch can shadow a future upstream `LayoutEngine`.

**Fix:** Update the tests to use `app.state.session_manager`, then delete the aliases, the sync wrapper, the unused field and the `setattr`.

### #34 — [Low] API design — `backend/main.py:181-195`

**What:** `/api/health` reads `_is_ready`, `_active_loops` and `_loop_telemetry` (private attributes) and returns `"decision_linker": True` etc. without checking anything.

**Why:** The Cloud Run healthcheck reports healthy even when the renderer is down (`renderer_ready: false` still returns HTTP 200), so a broken instance keeps receiving traffic.

**Fix:** Add public `is_ready()` and `health()` methods, and return 503 when the renderer is not ready so Cloud Run restarts the instance.

### #35 — [Low] API design — `backend/main.py:284-291`

**What:** For a meeting ID it doesn't recognise, `/timeline` returns 200 with the title `"Core Architecture Brainstorming: Auth & Real-Time Ingestion"`.

**Why:** Clients cannot tell "not found" apart from "empty meeting", and the made-up title then shows in the dashboard.

**Fix:** `raise HTTPException(404)` when the meeting is in neither store.

### #36 — [Low] Resilience — `backend/main.py:458-469`

**What:** `json.loads` can return a list or a scalar. `envelope_router.dispatch` then calls `msg.get` and raises `AttributeError`, which reaches the outer `except Exception` and closes the socket. A binary frame makes `receive_text()` raise in the same way.

**Why:** One malformed frame disconnects the wearer's live session.

**Fix:** `if not isinstance(msg, dict): continue`. Use `receive()` and ignore or log `bytes` frames.

### #37 — [Low] Dependency hygiene — `backend/requirements.txt:1-15`, `backend/pyproject.toml:7-20`

**What:** All dependencies use `>=` with no upper bound or lockfile. `pytest`, `pytest-asyncio` and `httpx` are in the runtime `requirements.txt` that the Dockerfile installs. `deepgram-sdk` is unused. `graph_engine.py` depends on `drawio_mcp.layout_engine.relayout_diagram`, an internal-looking API of a `0.x` package.

**Why:** Builds are not reproducible: a new upstream release of `drawio-mcp` or `google-genai` can break deploys without warning. The image is also bigger than it needs to be.

**Fix:** Split runtime and dev requirements, pin with a lock (`uv lock` / `pip-compile`), and cap `drawio-mcp<0.2`.

### #38 — [Low] Error handling — `backend/session_manager.py:172-199`

**What:** If `app.state.session_manager` is missing and importing `main` fails, `get_session_manager` returns `SessionManager()`: an empty store with a renderer that was never started.

**Why:** A wiring mistake turns into silent data splitting instead of an error at startup.

**Fix:** `raise RuntimeError("SessionManager not configured on app.state")`. Delete the import fallbacks and the unused `get_ws_session_manager`.

### #39 — [Low] Correctness — `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:61-67,106-109,127`

**What:** `setWebsocketUrl` closes the old socket and opens a new one. The old socket's `onclose` still fires `scheduleReconnect`. When the timer fires, `isConnected()` is false if the new socket is still in `CONNECTING`, so a third socket is created. Old sockets keep their `onmessage` handler.

**Why:** Duplicate sockets mean duplicate `DIAGRAM_UPDATED` handling and duplicate `asrTranscription` sends. This is rare (only on URL change or slow connect).

**Fix:** Before replacing a socket, set its handlers to no-ops. Check `readyState === 0 || readyState === 1` before reconnecting.

### #40 — [Low] Correctness — `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:187-203,427-441`; `SpatialInterfaceManager.ts:605-608`

**What:** `triggerHandRaised('⚠️ Auth Token Leak Risk', …, 'VULNERABILITY')` becomes `"🚩 ⚠️ Auth Token Leak Risk"`, because only the category's own emoji is checked. `substring(0, 28)` counts UTF-16 code units and can split a surrogate pair. The prefixing logic is written out twice.

**Why:** The pill can show broken glyphs or two icons on the waveguide display.

**Fix:** Have `onHandRaised` delegate to `triggerHandRaised`. Strip any leading emoji before adding the category icon. Truncate with `Array.from(title).slice(0, 28).join('')`.

### #41 — [Low] Maintainability: DRY — `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:136-162` vs `SpatialInterfaceManager.ts:454-480`; `web-dashboard/components/TopBar.tsx:42-48` vs `app/meetings/[id]/page.tsx:55-65`

**What:** `findSceneObject` and `searchHierarchy` are copied in both controllers. The meeting-duration calculation exists twice; TopBar's version leaves out interventions, so the two can show different durations.

**Fix:** Move the scene helpers to `SceneUtils.ts`. Compute `totalDurationMs` once in the page and pass it to `TopBar` as a prop.

### #42 — [Low] PRD: NFR-04 — `spectacles-lens/Assets/Scripts/SpatialInterfaceManager.ts:134,796,803`

**What:** The whiteboard (an SIK Interactable at `findInteractable('WhiteboardBackplate')`) is placed at `(50, 185, -230)` cm, which is 2.3 m away and 1.85 m high.

**Why:** NFR-04 requires all interactive colliders to sit between 1.0 and 1.3 m. Pinch targets at 2.3 m are harder to hit with hand rays. If the whiteboard is deliberately exempt because it overlays a physical board, the PRD should say so.

**Fix:** Either document the exemption in `docs/prd.md` NFR-04, or keep the board's interactable proxy (lock and ingest targets) within reach at about 1.15 m.

### #43 — [Low] Correctness — `web-dashboard/lib/xmlParser.ts:130-141`

**What:** For each type, in the order `database, decision, terminal, service`, a match on *either* style or label keywords wins. The `terminal` label keywords include `"end"` and `"user"`, so "Backend API", "Frontend" and "User Service" become terminals even though their style says `rounded=1`.

**Fix:** Do the style pass over all types first. Fall back to label keywords only when no style keyword matched.

### #44 — [Low] Repo hygiene — repo root, `spectacles-lens/Assets/Textures/`, `spectacles-lens/scripts/`

**What:** There are 25 untracked artifacts (`preview_*.jpg`, `temp_*.jpg`, `"Diagram_Concluded_1024x683 2.png"` plus its `.meta`), and 105 one-off scripts (`step197_full.ps1`, `test_mut.js`, `inspect_*.js`).

**Why:** The repo is judged publicly (25% for spec-driven rigor), and the clutter makes it hard to find the real source. The duplicate texture `.meta` adds a second asset to the Lens project.

**Fix:** Add `/*.jpg` and `preview_*` to `.gitignore`, delete the duplicate texture, and move the scripts you want to keep into `spectacles-lens/tools/` with a README. Delete the rest.

### #45 — [Info] Spatial UX — `spectacles-lens/Assets/Scripts/RaisingHandAgentController.ts:276-286`

**What:** Every frame, the orb is re-parented to the camera with a fixed local offset, which makes it fully head-locked.

**Why:** Snap's Spectacles design guidance discourages hard head-locked content because it is uncomfortable. A lazy-follow or billboarded world anchor at the same 1.15 m peripheral offset would better fit the "Spatial UX" judging criterion (20%). Doing the parent check and transform writes every frame is also wasted work.

**Fix:** Parent the orb once at start. If following is wanted, move toward the target pose with damping each frame, rather than snapping.

### #46 — [Info] Performance — `supabase/migrations/001_initial_schema.sql:56-66`

**What:** There is no ANN index on `knowledge_chunks.embedding`. Queries are filtered by `meeting_id` (which is indexed), so a sequential scan of each meeting's chunks is fine at hackathon scale.

**Fix:** When the data grows, add `create index on knowledge_chunks using hnsw (embedding vector_cosine_ops);` in a new migration.

### #47 — [Info] Configuration — `spectacles-lens/Assets/Scripts/PersistentStreamSocketClient.ts:6`

**What:** The default URL `ws://localhost:8000/ws/meeting/demo-session-01` only resolves in the Lens Studio Preview. On a device, the backend has to be reachable over `wss://`, and the meeting ID has to be a UUID (#5).

**Fix:** Document how to override it in `SCENE_HIERARCHY_SETUP.md`, and set the default to the deployed Cloud Run `wss://` URL with a UUID meeting ID.

## What's Done Well

- **Most fixes from the 10-17 audit landed:** the Gemini calls on the async paths now use `client.aio` and Supabase calls are wrapped in `asyncio.to_thread`; `EnvelopeRouter` splits the old god-function into one handler per event type (`envelope_router.py:383-411`); pinch errors now return `COMMAND_ERROR` instead of closing the socket; CORS reads an explicit origin list; the RAG drawer escapes HTML before rendering markdown (`RAGDrawer.tsx:302-314`).
- **The Lens camera pipeline matches the PRD:** setup is deferred to `OnStartEvent`, frames are downsampled to `imageSmallerDimension` 480, `Base64.encodeTextureAsync` is guarded by an `isEncodingActive` flag, and capture runs on a delta-time accumulator (`PeriodicCameraCapturer.ts`). This directly serves NFR-01 and NFR-05.
- **The WebSocket reconnect is correct for the runtime:** it uses `DelayedCallbackEvent` with capped exponential backoff and cleans up on `OnDestroyEvent` (`PersistentStreamSocketClient.ts:116-134,227-244`).
- **The data model is sound:** schema plus composite `(meeting_id, timestamp_ms)` indexes, and `match_knowledge_chunks` re-created with a pinned `search_path` (`003_fix_function_search_path.sql`).
- **The backend suite runs offline and deterministically:** 29 tests pass, and the live-network renderer test is properly marked `integration` and deselected in CI.

## Verdict
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODE AUDIT — FINDINGS: 47 (1 Critical, 10 High, 21 Medium, 12 Low, 3 Info)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Report saved: docs/reviews/2026-10-25-repo-prd-audit.md
Top action: Revert the uncommitted `supabase/migrations/002_enable_rls.sql`, which gives anon UPDATE/DELETE on every table. Then fix #10 (stale Lens tests) so the PRD fixes in #6–#9 can actually be verified.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
