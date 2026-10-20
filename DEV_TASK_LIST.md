# Dev Task List

source: SPEC_DOC.md
generated: 2026-10-19 21:35
updated: 2026-10-20 06:55

Status values: PENDING | IN_PROGRESS | EVAL | REWORK | DONE | BLOCKED

## Tasks

| ID | Phase | Task | Severity | Complexity | Model / Effort | Depends On | Status | Commit |
|:---|:------|:-----|:---------|:-----------|:---------------|:-----------|:-------|:-------|
| 01 | 1 | [Implement Supabase Row-Level Security Policies](DEV_TASK_01.yml) | medium | medium | sonnet / medium | — | DONE | 9b7dfc2 |
| 02 | 1 | [Enforce Strict Environment-Driven CORS Origins](DEV_TASK_02.yml) | medium | low | haiku / medium | — | DONE | 0f9dd61 |
| 03 | 1 | [Create Centralized NodeRegistry Specification Across Stacks](DEV_TASK_03.yml) | medium | medium | sonnet / medium | — | DONE | 6c758a2 |
| 04 | 2 | [Encapsulate Global In-Memory State in SessionManager](DEV_TASK_04.yml) | high | high | opus / medium | 02, 03 | DONE | 2e12cb7 |
| 05 | 2 | [Decompose meeting_websocket_hub into EnvelopeRouter](DEV_TASK_05.yml) | medium | high | opus / medium | 04 | DONE | a0e93a1 |
| 06 | 3 | [Add Timeline Pagination and Time-Window Querying](DEV_TASK_06.yml) | medium | medium | sonnet / medium | 04 | DONE | 5b27bfc |
| 07 | 3 | [Instrument RaisingHandAgent Health Telemetry](DEV_TASK_07.yml) | low | low | haiku / medium | 04 | DONE | 965edb9 |
| 08 | 3 | [Standardize Wire Timestamp Protocol and UI Formatter](DEV_TASK_08.yml) | low | low | haiku / medium | 06 | DONE | bd89456 |
| 09 | 4 | [Fix Relative Transform Scale in RaisingHandAgentController](DEV_TASK_09.yml) | low | low | haiku / medium | 03 | DONE | 5bb14b4 |
| 10 | 4 | [Implement Hermetic Headless Renderer Tests with Route Mocking](DEV_TASK_10.yml) | low | low | haiku / medium | 05 | DONE | 982b98c |

## Execution notes

- **Zero-Regression Invariant:** Existing test suites (28/28 pytest, 16/16 Lens Studio TypeScript tests, Next.js 15 production build) must pass after every task.
- **Migration Additivity:** `002_enable_rls.sql` is strictly additive; do not edit `001_initial_schema.sql`.
- **Backward Compatibility:** Deprecated module-level globals in `main.py` must alias to `app.state.session_manager` to prevent breaking existing integration tests.

## Open knowledge gaps

None (all 10 tasks are derived directly from resolved technical designs in SPEC_DOC.md).

## Run log

<!-- orchestrator appends one line per dispatch/verdict: -->
- 2026-10-19 22:04 - Task 01: IN_PROGRESS (Worker dispatched: sonnet / medium)
- 2026-10-19 22:04 - Task 01: EVAL (Evaluator dispatched: sonnet / low)
- 2026-10-19 22:04 - Task 01: DONE (commit: 9b7dfc2, verdict: PASS)
- 2026-10-19 22:05 - Task 02: IN_PROGRESS (Worker dispatched: haiku / medium)
- 2026-10-19 22:08 - Task 02: EVAL (Evaluator dispatched: haiku / low)
- 2026-10-19 22:08 - Task 02: DONE (commit: 0f9dd61, verdict: PASS)
- 2026-10-19 22:09 - Task 03: IN_PROGRESS (Worker dispatched: sonnet / medium)
- 2026-10-19 22:16 - Task 03: EVAL (Evaluator dispatched: sonnet / low)
- 2026-10-19 22:16 - Task 03: DONE (commit: 6c758a2, verdict: PASS)
- 2026-10-20 06:55 - Task 04: IN_PROGRESS (Worker dispatched: opus / medium)
- 2026-10-20 07:06 - Task 04: EVAL (Evaluator dispatched: sonnet / medium)
- 2026-10-20 07:06 - Task 04: DONE (commit: 2e12cb7, verdict: PASS)
- 2026-10-20 07:06 - Task 05: IN_PROGRESS (Worker dispatched: opus / medium)
- 2026-10-20 07:12 - Task 05: EVAL (Evaluator dispatched: sonnet / medium)
- 2026-10-20 07:12 - Task 05: DONE (commit: a0e93a1, verdict: PASS)
- 2026-10-20 07:13 - Task 06: IN_PROGRESS (Worker dispatched: sonnet / medium)
- 2026-10-20 07:18 - Task 06: EVAL (Evaluator dispatched: sonnet / low)
- 2026-10-20 07:18 - Task 06: DONE (commit: 5b27bfc, verdict: PASS)
- 2026-10-20 07:19 - Task 07: IN_PROGRESS (Worker dispatched: haiku / medium)
- 2026-10-20 07:24 - Task 07: EVAL (Evaluator dispatched: haiku / low)
- 2026-10-20 07:24 - Task 07: DONE (commit: 965edb9, verdict: PASS)
- 2026-10-20 07:25 - Task 08: IN_PROGRESS (Worker dispatched: haiku / medium)
- 2026-10-20 07:28 - Task 08: EVAL (Evaluator dispatched: haiku / low)
- 2026-10-20 07:28 - Task 08: DONE (commit: bd89456, verdict: PASS)
- 2026-10-20 07:29 - Task 09: IN_PROGRESS (Worker dispatched: haiku / medium)
- 2026-10-20 07:31 - Task 09: EVAL (Evaluator dispatched: haiku / low)
- 2026-10-20 07:31 - Task 09: DONE (commit: 5bb14b4, verdict: PASS)
- 2026-10-20 07:32 - Task 10: IN_PROGRESS (Worker dispatched: haiku / medium)
- 2026-10-20 07:35 - Task 10: EVAL (Evaluator dispatched: haiku / low)
- 2026-10-20 07:35 - Task 10: DONE (commit: 982b98c, verdict: PASS)
