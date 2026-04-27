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

## Deferred from: code review of story 2-5-global-error-handling-errorboundary-uncaught-exceptions (2026-04-27)

- **`unhandledRejection` behavior-change documentation** [server/src/server.ts:114] — Pre-2.5 the handler logged-only; post-2.5 it calls `process.exit(1)`. Future server code with dangling `Promise.reject` (anywhere — `someAsyncFn()` not awaited/caught) now crashes the process. Add a contributor note in CLAUDE.md or architecture.md so future authors know the rule changed. No code in current `server/src/` triggers this; deferred for Story 2.6's docs pass.

- **AC7 silent-swallow audit regex is incomplete** [Story 2.5 audit pattern] — The `rg 'catch\s*(\([^)]*\))?\s*\{\s*\}'` pattern catches truly-empty bodies but misses `} catch (e) { /* ignore */ }` or whitespace-only-with-comment bodies. Verified clean by accident for current code; widen the audit pattern in Story 2.6 if the codebase grows.

- **ErrorBoundary cannot recover without a full page reload** [client/src/ErrorBoundary.tsx + AC1] — By-design per AC1 (only Reload button mandated). A "Try again" reset path (`setState({hasError: false})`) would let users recover from transient render errors without losing input or optimistic state. Story 2.6 polish if anyone needs it.

## Deferred from: implementation of story 2-5-global-error-handling-errorboundary-uncaught-exceptions (2026-04-27)

- **Comment-density reduction across TaskInput / server.ts / apiClient / TaskItem / db.ts** [multiple files] — Story 2.5's Task 1 trimmed multi-line explanatory comments and inline AC-reference noise to fund the ~30 LOC of new error-handling code under the 1000-line NFR-M3 cap. All trims preserved the *why* of non-obvious choices (e.g., `INSERT OR IGNORE` idempotency rationale was compressed but not removed; FR15-immutable-createdAt rationale kept). If a future reviewer finds important context was lost, restore in Story 2.6 (which is the natural cleanup pass and may have more LOC headroom by then).

## Deferred from: code review of story 2-4-connectivity-detection-offline-banner (2026-04-27)

- **Concurrent-mutation race on rapid clicks of the same row (pre-existing)** [client/src/hooks/useTasks.ts:122-134] — `toggleTask` / `deleteTask` / `createTask` have no in-flight guard. Rapid double-clicks fire concurrent fetch requests; out-of-order responses → server/client divergence. Pre-existing from Epic 1; not introduced by Story 2.4. Extend the `retryInFlightRef` pattern to all mutations, or use a per-id mutation generation counter.

- **Brief one-frame flash of "online" UI on cold-start while offline** [client/src/hooks/useConnectivity.ts:6 + client/src/state/tasksReducer.ts:24] — `initialState.online === true`; `useConnectivity`'s mount-time `update()` flips to actual `navigator.onLine` in the second commit. User who opens the app already-offline sees one frame of "online" UI before the banner appears. Imperceptible in practice; fix via lazy `useReducer` init (~3 LOC) if anyone notices.

- **`instanceof TypeError` may catch non-network programmer errors** [client/src/hooks/useTasks.ts:113] — A `TypeError` thrown anywhere in `runMutation`'s `.then` chain gets misclassified as offline. Wrap only `request()` in the network-error catch; let dispatch errors propagate. Pairs with the Story 2.2 `AbortError` detection-breadth deferral.

- **`navigator.onLine` is unreliable on captive portals and some browsers** [client/src/hooks/useConnectivity.ts:5] — Hotel/airport WiFi awaiting login reports `true`; some Safari versions have false positives. Fully reliable detection requires active probing of `/api/health`. Platform constraint; consider in Story 2.6 if user reports surface this.

- **Two simultaneous `aria-live="assertive"` banners may compete on NVDA** [client/src/App.tsx:22-38] — When both `loadError` AND `!online` fire, two assertive live regions mount simultaneously. NVDA may truncate the first announcement. Options: downgrade offline banner to `polite`, unify into one banner with priority-based message, or accept the rare-cross-fire. Story 2.6 a11y pass to decide.

- **`<AlertCircle role="img">` cross-screen-reader variance** [client/src/components/TaskItem.tsx:49] — Modern JAWS handles `role="img" + aria-label` on `<svg>` correctly; older JAWS (pre-2018) needed an inner `<title>`. Verify cross-SR matrix in Story 2.6's a11y QA.

## Deferred from: code review of story 2-3-per-row-failure-state-retry-optimistic-ui-upgrade (2026-04-27)

- **Re-toggle of a soft-deleted row corrupts state** [client/src/state/tasksReducer.ts:39-43] — `OPTIMISTIC_TOGGLE` overwrites `pendingMutation: 'delete'` to `'toggle'` even for soft-deleted rows. UI doesn't expose the path (rows are filtered out), but assistive tech / programmatic clicks could reach it. Guard `OPTIMISTIC_TOGGLE` and re-dispatched `OPTIMISTIC_DELETE` against `pending+delete` rows.

- **`SYNC_OK` spread overwrites concurrent optimistic edits during the pending window** [client/src/state/tasksReducer.ts:51-55] — When `action.task` is provided, the reducer spreads the server task, losing any client-side mutation that landed during the pending window. Multi-mutation racing is the broader concern; address with the per-row "in-flight mutation generation" pattern.

- **AlertCircle's "Save failed" announcement relies on parent `aria-live="polite"` rather than a dedicated live region** [client/src/components/TaskItem.tsx:69-73] — Story 2.3 spec forbade nested `aria-live` regions; defers SR announcement of pending→failed transitions to the parent `<ul>`'s polite region. Verify cross-screen-reader behavior (NVDA/JAWS/VoiceOver) in the a11y QA pass; if announcement is unreliable, introduce a dedicated `role="status"` element near the icon.

- **TypeScript narrowing escape: `r as Task` cast in `retryMutation`** [client/src/hooks/useTasks.ts:151] — The success dispatch uses `r as Task` because the conditional-promise pattern resolves to `Promise<Task | void>`. Future API-shape changes won't be caught. Refactor to discriminated branches (separate `.then` per mutation kind) to preserve narrowing.

- **Soft-deleted row keyboard-focusable during React commit window** [client/src/components/TaskList.tsx:31-32 + TaskItem.tsx:58] — Render-layer filter unmounts the `<li tabIndex={0}>` after the next commit, dropping focus into `<body>`. Subsumed by the broader "focus-after-delete" deferral that's been open since Story 1.6 (`deferred-work.md` "Story 1.6 — Focus is lost into `<body>`").

- **AlertCircle horizontal-space jitter on failed↔synced transitions** [client/src/components/TaskItem.tsx:69-73] — The 44×44 icon span shifts text leftward by ~48 px when a row goes failed. Pure CSS fix (absolute positioning or smaller padding); land in the visual polish pass.

- **`pendingMutation` overwrite on delete-after-failed-toggle drops toggle intent silently** [client/src/state/tasksReducer.ts:39-43] — Probably the desired UX (user gives up on toggle and deletes), but uncovered by tests. Add a reducer test asserting the transition produces `pending+delete`.

- **`INITIAL_LOAD_FAIL` test reference-equality tightening** [client/src/state/tasksReducer.test.ts:38-47] — Tighten with `.toBe(start.tasks)` per Story 1.8's pattern to catch unnecessary cloning regressions on the failure path.

## Deferred from: implementation of story 2-3-per-row-failure-state-retry-optimistic-ui-upgrade (2026-04-27)

- **App.tsx focus-on-empty `useEffect` reverted to minimal form** [client/src/App.tsx:13-17] — Story 2.1's code-review patches added an SSR guard (`typeof document === "undefined"` check), try/catch around the focus call, type-narrowing cast (`as HTMLInputElement | null`), and an `activeElement !== inputElement` stealing-guard. Story 2.3 reverted the effect to its original 5-line form to reclaim ~15 LOC for budget pressure (NFR-M3). All four hardening items re-defer to **Story 2.6** (a11y/quality QA pass — already the natural owner of focus-management hardening per UX-DR49). The reverts are safe in production: (a) the SSR guard is dead code in this SPA-only deployment; (b) DOM `.focus()` doesn't throw in any current browser engine; (c) the cast was style; (d) the activeElement check protects against an edge case Story 2.1's spec didn't require. None were AC-mandated.

- **Comment density reduced across reducer / hook / TaskItem** [client/src/state/tasksReducer.ts, client/src/hooks/useTasks.ts, client/src/components/TaskItem.tsx] — Story 2.3 trimmed multi-line explanatory comments to single lines to fit the +69-LOC additions under the 1000-LOC NFR-M3 cap. The remaining comments still document the *why* of non-obvious choices (AR21 reducer purity, AbortError suppression rationale, soft-delete pattern). If a future reviewer finds the trimmed comments missed important context, restore them in Story 2.6's cleanup pass — there should be more LOC headroom by then (or before, if Story 2.6 deletes the deferred PageBanner fade-out polish that's already on the 2.6 list).

## Deferred from: code review of story 2-2-initial-load-failure-page-banner-with-retry (2026-04-27)

- **Banner re-announcement may be suppressed on identical retry-fail** [client/src/components/PageBanner.tsx + client/src/App.tsx:41] — NVDA/JAWS may suppress identical consecutive `aria-live="assertive"` announcements when Retry → Fail repeats with the same copy. Force re-announce via a `key` change tied to attempt count or via slight message variation. Land in Story 2.6 a11y/quality QA pass.

- **AbortError detection is too narrow** [client/src/hooks/useTasks.ts:65] — `err instanceof DOMException && err.name === "AbortError"` covers modern browsers but misses environments where abort surfaces as a plain `Error` (some polyfills, Node fetch, undici). Theoretical for our SPA-in-browser deployment; hardening to `err && typeof err === 'object' && (err as any).name === 'AbortError'` is defensive belt-and-braces.

- **Strict-mode dev-only console pollution during fast unmount** [client/src/hooks/useTasks.ts:67] — In React 18+ Strict Mode dev (mount → cleanup → remount), if a real (non-abort) error lands during the brief unmount window AND `resolved` was already set by cleanup, `console.error` fires before the suppressed dispatch. Dev-noise only; production unaffected.

- **`loadError` not cleared by mutation actions** [client/src/state/tasksReducer.ts:33-46] — If the load fails (banner shown) and the user types a task and presses Enter, `OPTIMISTIC_ADD` runs but `loadError` stays set; the banner remains above the freshly-typed task. Latent UX inconsistency. Story 2.6 should decide whether mutation success should clear the load-failed banner.

- **PageBanner has no manual dismiss path** [client/src/components/PageBanner.tsx + client/src/App.tsx:41] — Banner persists until a successful retry; no close button. WCAG 2.4.1 (no dismissable persistent content) is a stylistic concern, not a hard violation. Spec doesn't mandate dismiss; revisit in Story 2.6.

## Deferred from: implementation of story 2-2-initial-load-failure-page-banner-with-retry (2026-04-27)

- **AC10 — visible fade-in not wired (rAF mount-flip not implemented)** [client/src/App.tsx PageBanner render] — `PageBanner` already has `transition-opacity duration-200 ease-out` baked into its root, so the *class* requirement of AC10 is satisfied. But to see a visible 200 ms fade-in, App.tsx needs an `opacity-0 → opacity-100` flip on mount via `useState(false)` + `useEffect(() => requestAnimationFrame(() => setMounted(true)))`. Estimated cost: ~10 LOC. Skipped to preserve LOC headroom (Story 2.2 landed at 993/1000). Banner currently appears instantly at full opacity. Land in Story 2.6.

- **AC11 — fade-out on dismiss not wired (3-state machinery)** [client/src/App.tsx PageBanner render] — Conditional `{loadError && <PageBanner ...>}` unmounts the banner instantly when `loadError` clears (e.g. after successful Retry). To get the 100 ms `ease-in` fade-out, App.tsx needs `'hidden' | 'visible' | 'fading-out'` state with a `setTimeout(100)` between `loadError === null` and unmount. Estimated cost: ~15 LOC. Skipped for the same LOC-pressure reason. Pair with the AC10 fade-in fix in Story 2.6.

## Deferred from: code review of story 2-1-non-instructive-empty-state (2026-04-27)

- **TaskInput mount timing edge case** [client/src/App.tsx:10-14] — If TaskInput hasn't mounted when useEffect runs, focus call fails silently. Acceptable for this simple feature; React's rendering guarantees component mount order in practice.

- **Rapid state transition focus spam** [client/src/App.tsx:10-14] — Multiple focus calls during quick deletions are harmless (focus is idempotent). Edge case unlikely in normal usage.

- **Error state focus behavior** [client/src/App.tsx:10-14] — Focus still triggers during load errors. Acceptable since input remains functional and user can still attempt task creation.

- **Mobile/touch device focus handling** [client/src/App.tsx:10-14] — Programmatic focus may trigger virtual keyboards on mobile. Acceptable for this desktop-first app; touch UX refinements belong in broader mobile optimization story.

- **Concurrent user input interruption** [client/src/App.tsx:10-14] — Focus stealing from other fields is a valid concern but rare in this single-input app. Full focus management belongs in comprehensive a11y story (2.6).

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

## Deferred from: code review of story 1-6-task-list-view-with-happy-path-crud-view-complete-delete (2026-04-27)

- **AC5 checkbox-tick 0→1 scale animation does not run** [client/src/components/ui/checkbox.tsx:21] — shadcn's `<CheckboxPrimitive.Indicator>` ships `transition-none` and Radix only mounts the indicator when checked, so the tick appears instantly. The 100 ms ease-out scale required by AC5 needs either editing the primitive (against story rule) or a custom indicator with `forceMount` + scale CSS. Best handled by Story 2.6 (a11y/quality pass) or a dedicated polish story.

- **ROLLBACK clobbers concurrent successful mutations** [client/src/hooks/useTasks.ts + state/tasksReducer.ts ROLLBACK case] — uniform `ROLLBACK { previousTasks }` restores the full snapshot, which can wipe out unrelated optimistic mutations that succeeded between the failed mutation's dispatch and rejection. Spec-acknowledged trade-off for single-user MVP. Story 2.3's per-row `'failed'` status will replace this with surgical per-action rollback.

- **Focus is lost into `<body>` after deleting the focused row** [client/src/components/TaskItem.tsx Delete/Backspace handler] — keyboard users land on `<body>` after delete with no focus restoration. Capture next/previous sibling before optimistic delete and re-focus after the next render. Defer to Story 2.6.

- **Mutation errors are silent (`console.error` only)** [client/src/hooks/useTasks.ts mutation `.catch` blocks] — failed POST/PATCH/DELETE trigger ROLLBACK but the user sees no UI feedback. Story 2.3 introduces per-row `'failed'` status + Retry affordance.

- **`aria-live="polite"` on the data `<ul>` may over-announce** [client/src/components/TaskList.tsx] — every list mutation re-reads content. Spec mandates the live region on the `<ul>` (AC16); revisit during Story 2.6 if SR testing surfaces noise.

- **`apiClient` does no Content-Type validation on 2xx responses** [client/src/api/apiClient.ts] — non-JSON 200 (e.g., dev-server SPA fallback returning HTML) would crash `.json()` and trigger misleading rollback. Add `if (!res.headers.get("content-type")?.includes("application/json")) throw ...` before `.json()` if this surfaces.

- **Server-shape responses are unchecked-cast (`as Task`)** [client/src/api/apiClient.ts] — contract drift breaks at runtime, not at compile time. Architecture's AR23 accepts this trade-off. Add `zod`-style runtime validation if a future story introduces contract churn.

- **`crypto.randomUUID()` requires a secure context** [client/src/hooks/useTasks.ts createTask] — throws on plain-HTTP non-localhost deployments. Architecture's single-origin model assumes HTTPS or localhost; if a non-secure deployment surfaces, add a feature-detect polyfill.

- **`document.getElementById("task-input")` hardcodes Story 1.5's TaskInput id** [client/src/components/TaskItem.tsx ArrowUp branch] — first-row ArrowUp navigation will break if Story 1.5's input id ever changes. Pass a ref through props if multi-instance scenarios appear.

- **No fetch abort on unmount for mutations** [client/src/hooks/useTasks.ts mutation handlers] — `.then`/`.catch` may dispatch into a torn-down reducer if the user navigates away mid-fetch. React 19 logs a warning. Extend the initial-load `cancelled` flag pattern to the three mutation callbacks if this becomes observable.

## Deferred from: code review of story 1-7-production-build-single-origin-serving (2026-04-27)

- **Windows `cmd.exe` does not parse inline `NODE_ENV=production cmd` syntax** [server/package.json:10] — `npm start` would fail on Windows. Spec explicitly accepts macOS/Linux scope. Swap to `--env-file=.env.production` (file containing `NODE_ENV=production`) or add `cross-env` devDep if Windows support ever lands.

- **AC7 / AC8 perf measurements need a real-browser pass** — Story 1.7 measured TTFB as a proxy because no real browser environment was available in the dev session. A code reviewer or QA should open Chromium DevTools against `npm start`, capture FCP/FMP and Network→paint deltas, and confirm the budgets (1000 ms / 200 ms) hold before any production deploy. Numbers are very likely fine (74.5 KB gzip bundle + sub-ms server response), but the spec literally requires DevTools Performance.

- **Orchestrator `scripts/dev.mjs` inherits outer `NODE_ENV`** [scripts/dev.mjs:6-10, 33-34] — if the dev has `NODE_ENV=production` exported in their shell or `.envrc`, `npm run dev` runs as production mode and the dev server fails to boot (no `client/dist/` exists in dev). Fix when `scripts/dev.mjs` is next touched: pass `env: { ...process.env, NODE_ENV: undefined }` to the `spawn` options. Pre-existing Story 1.1 shape; not introduced by this story.

- **`isProduction` strict equality misses `"production "` / `"PRODUCTION"`** [server/src/server.ts:21] — `process.env.NODE_ENV === "production"` won't match a trailing-space or differently-cased value. Inline `NODE_ENV=production` sets exactly the canonical value, so safe today. Use `process.env.NODE_ENV?.trim().toLowerCase() === "production"` for paranoid robustness.

- **No automated regression test for AR25 route ordering** — `tasksRoutes` MUST register before `@fastify/static` and the SPA `setNotFoundHandler`. A future refactor could silently break `/api/*` routing by reordering. Story 1.8's smoke tests should include an explicit `GET /api/tasks` returns 200 (not the SPA shell HTML) assertion.

## Deferred from: code review of story 1-8-baseline-tests-reducer-db-routes (2026-04-27)

- **Module-singleton coupling between db.test.ts and routes/tasks.test.ts** [server/src/db.ts:31 + both test files' top-level `process.env.DB_PATH`] — works today because `tsx --test` runs files in separate child processes by default. If anyone ever runs them in-process (custom runner, `--test-isolation=none`), the singleton coupling silently breaks the second file. Two hardening paths: (a) document/assert `--test-isolation=process` at file top, or (b) refactor `db.ts` to expose `openDb(path)` factory + a singleton wrapper.

- **AC1b ordering test relies on `Date.now()` advancing within 5 ms** [server/src/db.test.ts:39-53] — `await sleep(5)` + ms-resolution timestamps could flake under CI load. Bump to 10–20 ms or inject a clock if the test ever fails non-deterministically.

- **Purity test only exercises `OPTIMISTIC_TOGGLE` with frozen input** [client/src/state/tasksReducer.test.ts:108-123] — extract a `deepFreeze` helper and apply to every action's input for stronger guard. Spec was permissive ("at least one test"); satisfied but not maximal.

- **`crypto.randomUUID()` as a global** [server/src/routes/tasks.test.ts] — works on Node ≥19 with `globalThis.crypto`. `import { randomUUID } from "node:crypto"` is more portable.

- **Routes test cleanup goes through HTTP `app.inject()`** [server/src/routes/tasks.test.ts:32-38] — if DELETE route is broken, cleanup cascades failures. Counter-argument: by-design, exercises the route under test. Accept trade-off; revisit if cleanup-failure noise hides real regressions.

- **Temp DB files leak in `tmpdir()` if `before()` throws** [both server test files] — PID-keyed filenames are reused on PID recycling. Add a defensive pre-import `unlinkSync` or randomize the filename per run.

- **Server has no eslint config** [server/] — pre-existing Story 1.1 shape. Test files (and source files) aren't linted server-side. Adding `server/eslint.config.js` would catch the kind of unused-import issue that surfaced in P1 automatically.

- **Security-headers regression test + AR25 route-ordering smoke test** — both flagged as optional stretch goals in Story 1.8's Dev Notes; not pursued. Land in Story 2.6 (a11y/quality QA pass) or a dedicated "test coverage hardening" story.
