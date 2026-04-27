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

## Deferred from: code review of story 1-4-frontend-design-foundation-shadcn-ui-theme-layout (2026-04-27)

- **`prefers-reduced-motion` rule may zero out Radix state-change transitions** [client/src/index.css:83-91] — the spec literally mandates the AC11 pattern (`transition-duration: 0ms !important` on `*, *::before, *::after`), so user-visible behavior matches the AC. If reduced-motion users report jarring instant state-changes (Checkbox check/uncheck, Button press), revisit with a rule that distinguishes pure motion from state-change transitions.

- **Empty `data-slot` divs render a blank page until Stories 1.5/1.6 ship** [client/src/App.tsx:6-8] — by design; these are anchors that get replaced. If a deploy happens before 1.5/1.6, add a placeholder skeleton row + visually-hidden heading so users don't land on a fully blank page.

- **`dark:*` utility classes from shadcn primitives emit dead CSS** [client/dist/assets/index-*.css] — known trade-off from the AC6 deviation. `@custom-variant dark (&:is(.dark *))` scopes the rules to a never-applied ancestor; cost is a few hundred bytes of unreachable CSS. Acceptable for the lifetime of this spec.

- **No favicon** [client/index.html, client/public/] — browsers will 404 on `/favicon.ico`. Ship a same-origin SVG favicon (NFR-S4 compliant) when convenient.

- **`outline-ring/50` applied to the universal `*` selector** [client/src/index.css:71-73] — verbatim from shadcn CLI's `@layer base` scaffold. Don't edit unless it causes spurious focus rings on non-interactive elements; if so, scope to `:where([role], button, [tabindex])`-style selectors.

## Deferred from: code review of story 1-5-taskinput-single-field-entry-with-keyboard-commit (2026-04-27)

- **`String.prototype.trim()` doesn't strip zero-width / BOM characters** [client/src/components/TaskInput.tsx:62] — theoretical edge case where a paste of only zero-width chars (`​`, `‍`, `﻿`) bypasses the empty-check and submits a non-empty-but-invisible task. Low risk for a single-user app; revisit if a "reject all-whitespace-like input" requirement appears.

- **Layout shifts ~20 px when over-limit notice appears/disappears** [client/src/components/TaskInput.tsx:83 + parent gap] — visible vertical jump in the sibling task-list slot. Reserve space via `min-h-5` on the wrapper or render the notice with `invisible` class when hidden. Not in current spec; visual polish.

- **Cmd / Ctrl / Alt + Enter still submits** [client/src/components/TaskInput.tsx:60] — only `shiftKey` is the "skip submit" modifier per spec; other modifier chords fall through to submit. Tighten to "no modifiers" if a future user reports surprises.

- **`console.log` placeholder in `App.tsx`'s `handleSubmit`** [client/src/App.tsx:5-6] — Story 1.6 will replace it with the reducer dispatch + POST. If 1.6 slips and any prod build ships before then, gate the log on `import.meta.env.DEV`.
