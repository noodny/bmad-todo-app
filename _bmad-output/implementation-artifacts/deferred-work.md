# Deferred Work Log

## Deferred from: code review of story 1-1-project-scaffold-orchestration (2026-04-24)

- **Placeholder test script exits 0 without running tests** [package.json] — Matches spec intent for Story 1.1; real tests arrive in Story 1.8. No action needed; this is expected behavior.

- **`wildcard: false` configuration undocumented** [server/src/server.ts:22] — Config is working as intended (prevents @fastify/static from serving wildcard-matching files). Document rationale in a future pass or accept as internal knowledge; not blocking.

- **stdin isolation for orchestrator** [scripts/dev.mjs:3] — Setting stdio 'ignore' for stdin is acceptable for the orchestrator; prevents deadlocks if a dependency tries to prompt interactively. Document if needed for future maintainers.

- **Placeholder `/api/tasks` endpoint documents spec, not implementation** [server/src/server.ts:15] — Spec-mandated for Story 1.1; real handlers and route structure arrive in Story 1.3. Expected behavior.

## Deferred from: code review of story 1-2-task-persistence-layer-sqlite-schema-repository (2026-04-24)

- **`app.listen` failure + `app.close()` reject path skip `closeDb()`** [server/src/server.ts:83-88, 99-104] — Pre-existing Story 1.1 shape; leaks WAL/SHM file handles on rare boot/shutdown error paths. Low impact for MVP single-user but worth closing when shutdown flow next gets touched.

- **`updateTask` TOCTOU between UPDATE and re-read** [server/src/db.ts:97-105] — UPDATE can succeed then a concurrent `deleteTask` can remove the row before the re-read, causing the function to return `null` after a successful update. Impossible in single-user MVP; wrap in `db.transaction` when concurrency arrives.

- **`Date.now()` millisecond ties break deterministic ordering** [server/src/db.ts:46, 91] — Two tasks created in the same millisecond share `created_at`; `ORDER BY created_at ASC` becomes non-deterministic among ties. Essentially impossible at single-user typing cadence. Add `ORDER BY created_at ASC, id ASC` as a tiebreaker if ordering ever flakes.

- **No `busy_timeout` pragma** [server/src/db.ts:32-33] — Default is 0, so any future contention raises `SQLITE_BUSY` immediately with no wait. Set to ~5000ms when concurrency (e.g., background workers, multiple processes) appears.

- **`unhandledRejection` handler does not trigger DB shutdown** [server/src/server.ts:95-97] — Pre-existing Story 1.1 shape; current handler only logs, leaving the process in an inconsistent state with the DB still open.

- **Final `app.log.info` may be dropped before `process.exit(0)`** [server/src/server.ts:81-82] — Pre-existing Story 1.1 shape; pino is async and the "Server closed successfully" message can be lost on exit. Flush logger (or `await once(app.log, 'drain')`) if the signal matters.

## Deferred from: code review of story 1-3-task-rest-api-get-post-patch-delete (2026-04-27)

- **`text` accepts whitespace-only / control chars / unnormalized Unicode** [server/src/routes/tasks.ts:24] — `minLength: 1` permits `" "`, `"\t"`, `"\0"`, RTL/zero-width chars; no NFC normalization or trim. UI layer trims before submit (Story 1.5), but server is the trust boundary. Add server-side trim+nonempty check next time route validation gets touched.

- **No `bodyLimit` override on Fastify factory** [server/src/server.ts:23-36] — defaults to 1 MiB; API surface only needs ~250 bytes. Tighten when the security hardening pass lands. Pre-existing Story 1.1 shape.

- **No response schemas on GET / POST / PATCH** [server/src/routes/tasks.ts:46,48,58] — adding response schemas would prevent accidental column leakage if `db.ts` ever returns extra fields, and would enable Fastify's fast-json-stringify path. Not in current spec; nice-to-have.

- **No `connectionTimeout` / `requestTimeout` on Fastify** [server/src/server.ts:23-36] — Slowloris-class slow-body attacks remain possible. Pre-existing Story 1.1 shape; not in PRD scope.
