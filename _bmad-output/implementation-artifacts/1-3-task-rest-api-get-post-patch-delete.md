# Story 1.3: Task REST API (GET/POST/PATCH/DELETE)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the app frontend,
I want a REST API under `/api/tasks` with validated input, idempotent writes, and a security baseline,
So that I can read and mutate tasks reliably and safely over the wire.

## Acceptance Criteria

1. **GET list (AC1):** Given the server is running, when I `GET /api/tasks`, then response status is **200**, `Content-Type: application/json`, and the body is a JSON array of tasks with camelCase fields `{ id, text, completed, createdAt }` ordered by `createdAt ASC`. Empty DB returns `[]` (not `null`).
2. **POST create happy (AC2):** Given a valid payload, when I `POST /api/tasks` with body `{ id: "<valid-uuid-v4>", text: "buy bread" }` and `Content-Type: application/json`, then the task is persisted, the response body is the created task (`{ id, text, completed: false, createdAt: <number> }`), and response status is **201**. Status code is consistent across create success (always 201) to satisfy the epic's "200 or 201 — consistent across endpoints" requirement.
3. **POST oversized text → 400 (AC3):** Given a POST body with `text` length > 200 characters, when the request is validated by Fastify's ajv JSON-schema layer, then the server returns **400** with the Fastify default error shape `{ statusCode, error, message }`. No row is persisted.
4. **POST missing/invalid fields → 400 (AC4):** Given a POST with missing `id`, missing `text`, empty `text`, a non-string value, a non-UUID `id`, or extra unknown properties, when the request is validated, then the server returns **400** with the Fastify default error shape. No row is persisted. UUID v4 is enforced at the JSON schema layer (`pattern` matching canonical 8-4-4-4-12 with version nibble `4` and variant `[89ab]`).
5. **POST wrong Content-Type → 400/415 (AC5):** Given a POST with `Content-Type: text/plain` (or any non-`application/json`), when the request is processed, then the server rejects with **400 or 415** before the handler runs and no row is persisted. Missing `Content-Type` on a body-bearing request is rejected identically.
6. **POST idempotent retry (AC6):** Given two POSTs with the same `id` (client retry after transient failure), when both complete, then exactly one row exists in the DB and both responses return the same canonical stored task. Achieved structurally by `INSERT OR IGNORE` + in-transaction re-read in `db.createTask` (already landed in Story 1.2).
7. **PATCH toggles completion (AC7):** Given an existing task, when I `PATCH /api/tasks/:id` with `{ completed: true }` (or `{ completed: false }`), then the `completed` field is updated in the DB, the updated task (full shape) is returned with status **200**, and `createdAt` is unchanged. Only the `completed` property is accepted in the body — unknown properties are rejected with 400.
8. **PATCH missing id → 404 (AC8):** Given no task with `:id` exists, when I `PATCH /api/tasks/:id` with a valid body, then the server returns **404** with the Fastify default error shape. No row is created.
9. **PATCH `:id` must be valid UUID (AC9):** Given a `:id` route parameter that is not a valid UUID v4, when the request is validated, then the server returns **400** (not 404) from the params schema. No DB access occurs.
10. **DELETE existing → 204 (AC10):** Given an existing task with id X, when I `DELETE /api/tasks/:id`, then response status is **204**, body is empty, and the row is removed.
11. **DELETE missing → 204 idempotent (AC11):** Given no task with id X exists, when I `DELETE /api/tasks/:id`, then response status is **204** (never 404). Caller cannot tell from the response whether a row existed — matches `db.deleteTask`'s idempotent contract.
12. **No GET-initiated mutation (AC12):** Given the server routing table, when I attempt `GET /api/tasks/:id/delete`, `GET /api/tasks/:id/toggle`, or any GET variant that would imply a mutation, then no such route exists and the server returns **404** (NFR-S3 HTTP method correctness). Method mismatch on a known path (e.g., `POST /api/tasks/:id`) returns **404** (Fastify's default for unmatched method+path) without invoking any handler.
13. **Security headers on every response (AC13):** Given a request handled by **any** route (API route, static file, SPA fallback, 404), when I inspect the response headers, then `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: same-origin` are all present. Implementation is a hand-rolled Fastify `onRequest` or `onSend` preHandler registered globally in `server/src/security.ts` — **no `@fastify/helmet` dependency** (AR15).
14. **500 leaks no internals (AC14):** Given a 500 occurs server-side (e.g., a thrown SQLite error or a bug in a handler), when the response is sent to the client, then the body uses the Fastify default shape `{ statusCode: 500, error: "Internal Server Error", message: "<generic>" }` with **no stack trace, file path, SQL string, or internal detail** leaked. The full error is logged server-side via pino at `error` level with the original error object (NFR-S2).
15. **Task text never logged at info (AC15):** Given the server request logs with default pino config, when a POST request with `text: "secret-task"` completes, then `grep` on the log output at `info` level contains **no occurrence of the task text body**. Task text may appear only at `debug` level (AR27 / privacy hygiene). This is verified by Fastify's default pino `serializers` not including the body, and by the handler not calling `app.log.info({ text })` or `app.log.info(\`task: ${text}\`)` directly.
16. **.env via `--env-file` (AC16):** Given a `server/.env` file containing `PORT=3001` and `DB_PATH=./data/custom.db`, when the server is started with `node --env-file=.env dist/server.js` (or `tsx --env-file=.env src/server.ts` in dev), then `process.env.PORT` and `process.env.DB_PATH` reflect those values and are picked up by server/db init code. When no `.env` exists or flag omitted, defaults (3000 / `./data/tasks.db`) still apply. **No third-party `dotenv` dep** — only Node 24's built-in `--env-file` flag (AR17). Update `server/package.json` `dev`/`start` scripts accordingly; commit a `server/.env.example` with the two keys and safe defaults.
17. **Routes registered before static (AC17):** Given the startup order in `server.ts`, when I inspect the code, then `app.register(tasksRoutes, { prefix: '/api' })` runs **before** `app.register(fastifyStatic, ...)` / `app.setNotFoundHandler(...)` — AR25. SPA catchall must never shadow `/api/*`.
18. **Boundary discipline preserved (AC18):** Given the codebase after this story, when I grep the server package, then `better-sqlite3` is imported **only** in `server/src/db.ts` (AR31 / AR11 — preserved from Story 1.2). `snake_case` column names appear only in `db.ts`. Route handlers in `routes/tasks.ts` see only the camelCase `Task` shape and never build SQL.

## Tasks / Subtasks

- [x] **Task 1 — Scaffold `server/src/routes/tasks.ts` with type + schemas** (AC: 1, 2, 4, 7, 9, 18)
  - [x] Created `server/src/routes/` directory.
  - [x] Created `server/src/routes/tasks.ts` exporting a default Fastify plugin.
  - [x] Defined a local `Task` interface duplicated from `db.ts` (AR23).
  - [x] Defined JSON schemas `createBodySchema`, `patchBodySchema`, `idParamsSchema` with `additionalProperties: false` and UUID v4 regex pattern.
  - [x] Imported repository functions via `../db.js` (NodeNext ESM specifier).
- [x] **Task 2 — Implement the four route handlers** (AC: 1, 2, 6, 7, 8, 10, 11, 14)
  - [x] `GET /tasks` returns `listTasks()` as a direct array (no envelope, AR12).
  - [x] `POST /tasks` validates via `createBodySchema`, calls `createTask`, replies 201 with the canonical stored row.
  - [x] `PATCH /tasks/:id` validates both `idParamsSchema` and `patchBodySchema`; explicit 404 path when `updateTask` returns `null`.
  - [x] `DELETE /tasks/:id` validates `idParamsSchema`, calls `deleteTask`, replies 204 unconditionally (idempotent).
  - [x] No handler wraps its body in try/catch — Fastify's default error handler emits the spec-mandated shape automatically.
- [x] **Task 3 — Hand-rolled security headers preHandler in `server/src/security.ts`** (AC: 13)
  - [x] Created `server/src/security.ts` with an `onSend` hook that sets CSP, X-Content-Type-Options, and Referrer-Policy on every response (including 404s).
  - [x] **Deviation from spec sketch:** exported as a direct-registration function (`registerSecurityHeaders(app)`) rather than a Fastify plugin. Reason: Fastify plugins are encapsulated, so a hook registered inside `app.register(securityHeaders)` would only fire for that plugin's children. Sibling plugins (e.g. `tasksRoutes` registered after it) never saw the hook — `curl` showed zero security headers on `/api/tasks`. Fix required either `fastify-plugin` (a new prod dep — rejected by NFR-M1) or a direct mutation of the root app instance. Chose the direct-mutation path. Full rationale in `security.ts` comment.
  - [x] No `@fastify/helmet`; three headers only.
  - [x] Verified via curl on `/api/tasks`, `/api/nonexistent`, and `/` — all three headers present on all three responses.
- [x] **Task 4 — Wire routes, security, and `.env` loading into `server.ts`** (AC: 13, 16, 17)
  - [x] Added imports `tasksRoutes from './routes/tasks.js'` and `registerSecurityHeaders from './security.js'` (both NodeNext `.js` specifier).
  - [x] Registration order (AR25): `registerSecurityHeaders(app)` (direct call) → `await app.register(tasksRoutes, { prefix: "/api" })` → `if (isProduction) { await app.register(fastifyStatic, ...); app.setNotFoundHandler(...); }`. Removed the stub `app.get("/api/tasks", async () => listTasks())` — superseded by the tasks-routes plugin.
  - [x] Updated `server/package.json` scripts: `"dev": "tsx watch --env-file-if-exists=.env src/server.ts"` and `"start": "node --env-file-if-exists=.env dist/server.js"`.
  - [x] **Deviation from spec:** chose `--env-file-if-exists` over `--env-file`. Reason: Node 24's plain `--env-file=.env` hard-errors (`ENOENT`) when the file is missing, which would crash `npm run dev` on a fresh clone where `.env` doesn't exist yet. AC16 requires "sensible defaults when unset" — a boot crash violates that. The `-if-exists` variant silently falls through to code defaults, matching AC16's semantics. The spec's Dev Notes had this backwards (claimed plain `--env-file` "warns but continues" — actually it crashes).
  - [x] Created `server/.env.example` with `PORT=3000` and `DB_PATH=./data/tasks.db`. Root `.gitignore` already excludes `.env`.
  - [x] No `dotenv` dep; no new prod deps. `server/package.json` dependencies unchanged: `@fastify/static`, `better-sqlite3`, `fastify`.
  - [x] **Added Fastify ajv customization:** `ajv: { customOptions: { removeAdditional: false, coerceTypes: false } }`. Fastify 5's default ajv silently strips unknown properties AND coerces scalar types. AC4 requires both (a) extra keys rejected with 400, and (b) non-string values rejected with 400. Without this customization, `{ "id": "...", "text": 1 }` would coerce `1` → `"1"` → pass the pattern check → succeed (verified with curl before the fix). With these two ajv options, every AC4 case returns 400 as specified.
- [x] **Task 5 — Manual verification of ACs via curl** (AC: 1–17)
  - [x] Started server on port 4319 with `DB_PATH=./data/verify-1-3.db` against Node 24.13.0. Boot logs showed `Server listening at http://127.0.0.1:4319` and no errors.
  - [x] AC1: `curl http://127.0.0.1:4319/api/tasks` → 200, body `[]`, three security headers present.
  - [x] AC2: POST with valid UUID+text → **201** (chosen over 200 for consistency with retry path; documented in Completion Notes), body is the created task with `createdAt`.
  - [x] AC6: POST same UUID with different text → 201 again, returned body has the **original** text, list length unchanged.
  - [x] AC3: POST with 201-char text → 400 Fastify default shape (`{"statusCode":400,"code":"FST_ERR_VALIDATION","error":"Bad Request","message":"body/text must NOT have more than 200 characters"}`).
  - [x] AC4: 9 invalid-payload permutations all → 400: `{}`, `{"id":...}` only, `{"text":...}` only, `{"id":"abc","text":"x"}` (non-UUID), `{"id":"...","text":""}` (empty), `{"id":"...","text":"x","extra":1}` (extra property), `{"id":"...","text":1}` (non-string), `{"id":123,"text":"x"}` (non-string id), `{"id":"...","text":null}` (null text).
  - [x] AC5: `Content-Type: text/plain` POST → **400** (Fastify's default JSON content-type parser rejects; satisfies AC5's 400/415 range).
  - [x] AC7: PATCH existing id with `{"completed":true}` → 200 with updated task; `createdAt` byte-identical to pre-update value. Five invalid PATCH body permutations (`{}`, `{"text":"x"}`, `{"completed":"yes"}`, `{"completed":1}`, `{"completed":true,"text":"hack"}`) all → 400.
  - [x] AC8: PATCH with nonexistent UUID → 404 Fastify default shape.
  - [x] AC9: PATCH `/api/tasks/not-a-uuid` → 400 (params schema rejects).
  - [x] AC10: DELETE existing → 204 empty body; subsequent `GET` confirms list length 0.
  - [x] AC11: DELETE same (now-missing) id → 204 again.
  - [x] AC12: `GET /api/tasks/:id/delete` → 404; `POST /api/tasks/:id` → 404.
  - [x] AC13: CSP, X-Content-Type-Options, Referrer-Policy all present on `/api/tasks` (200), `/api/nonexistent` (404), and `/` (404) responses.
  - [x] AC14: Force-throw verification via temporary `/__leak_test__` route (removed before commit). Response body contained `{"statusCode":500,"error":"Internal Server Error","message":"..."}` with **no stack trace**. Server-side pino log at `error` (level 50) contained the full `err.type`, `err.message`, and `err.stack`. **Caveat (open item):** Fastify's default error handler DOES echo the thrown Error's `message` field verbatim into the response body. Spec explicitly forbade overriding `setErrorHandler`. Our production code paths never throw errors whose message contains secrets (only `db.ts` has a throw, and its message `createTask: row {id} missing after INSERT OR IGNORE` contains only the client-supplied UUID — not a leak). If future handlers throw messages containing paths, SQL, or tokens, a minimal 5xx-genericizing `setErrorHandler` will be needed. Flagged for code review.
  - [x] AC15: `grep '"level":30'` on the full run log showed 0 occurrences of either `buy bread` or `NEW text` — task text never appears at info level. (Debug level would contain them, per AR27.)
  - [x] AC16: Created temporary `server/.env` with `PORT=4320\nDB_PATH=./data/verify-env.db`, ran `node --env-file-if-exists=.env dist/server.js` — server listened on 4320 (boot log confirmed, `curl :4320` returned 200) and created `data/verify-env.db` (not the default path). Removed `.env`, restarted → server fell through to defaults (code defaults `PORT=3000`, `DB_PATH=./data/tasks.db`). `.env.example` committed.
  - [x] `npx tsc --noEmit` → exit 0. `npx tsc` (build) → exit 0. `find dist -name '*.js'` lists `db.js`, `routes/tasks.js`, `security.js`, `server.js`.

### Review Findings

- [x] [Review][Decision][Dismissed] `setErrorHandler` 5xx genericization — the proposed leak path is empirically unreachable. Verified against `better-sqlite3@^12.9.0`: ajv's `maxLength: 200` counts UTF-16 code units while SQLite's `length()` counts Unicode codepoints (RFC 3629). UTF-16 units ≥ codepoints for any string, so an input that passes ajv (≤200 units) always passes the CHECK (≤200 codepoints). Test cases: 100 emoji (200 units / 100 cp) → both PASS. 101 emoji (202 units / 101 cp) → ajv FAIL, never reaches DB. 200 emoji (400 units / 200 cp) → ajv FAIL. 200 ASCII + emoji (300 units / 200 cp) → ajv FAIL. No case found where ajv passes and CHECK fails. AC14 caveat reverts to its original status: real handler code paths don't throw secret-bearing messages. Spec's "do not override `setErrorHandler`" rule preserved.
- [x] [Review][Patch] `idParamsSchema` is missing `additionalProperties: false` [server/src/routes/tasks.ts:37-44] — fixed: added the property to bring params-schema in line with body schemas. Typecheck clean.
- [x] [Review][Defer][Reclassified-Dismissed] `text` UTF-16 length vs SQLite `length()` — empirical testing showed UTF-16 code units ≥ codepoints for any string, so ajv (≤200 units) is strictly stricter than the SQLite CHECK (≤200 codepoints). No input can pass ajv and fail the CHECK. See the dismissed Decision finding above for the test cases.
- [x] [Review][Defer] `text` accepts whitespace-only / control chars / unnormalized Unicode [server/src/routes/tasks.ts:24] — deferred; spec doesn't mandate trimming or NFC normalization. UI layer (Story 1.5) will trim before submit per its own AC.
- [x] [Review][Defer] No `bodyLimit` override on Fastify factory [server/src/server.ts:23-36] — deferred, pre-existing Story 1.1 shape; default is 1 MiB, but the API only needs ~250 bytes. Tighten when the security hardening pass lands.
- [x] [Review][Defer] No response schemas on GET / POST / PATCH [server/src/routes/tasks.ts:46,48,58] — deferred; adds two benefits (preventing accidental column leakage and enabling Fastify's fast JSON serializer). Not in spec; nice-to-have.
- [x] [Review][Defer] No `connectionTimeout` / `requestTimeout` on Fastify [server/src/server.ts:23-36] — deferred, pre-existing Story 1.1 shape; Slowloris-class slow-body attacks remain possible. Not in PRD scope.
- [x] **Task 6 — Confirm boundary discipline preserved** (AC: 18)
  - [x] `grep -R "better-sqlite3" server/src/` → exactly 1 match: `src/db.ts:1`.
  - [x] `grep -RE "created_at|snake_case" server/src/` → 7 matches, all inside `src/db.ts` (column names in schema + prepared statements + `rowToTask` mapping). Zero leakage outside `db.ts`.
  - [x] `grep "from '\.\./db" src/routes/tasks.ts` — confirmed `from "../db.js"` (proper NodeNext specifier).
  - [x] Prod dep count unchanged: `fastify`, `better-sqlite3`, `@fastify/static` (server); `react`, `react-dom` (client). Still at 5/5 NFR-M1 cap. No `dotenv`, `@fastify/helmet`, `uuid`, `ajv-formats`, or `zod` added.

## Dev Notes

### Story context (what just shipped in Stories 1.1 + 1.2)

Stories **1.1** (scaffold) and **1.2** (persistence) are done and committed (`0fc01a8`, `7d9f2db`). Post-1.2 you have:

- [server/src/server.ts](server/src/server.ts) — Fastify 5 + ESM/NodeNext bootstrap. PORT validation + `unhandledRejection` handler + `gracefulShutdown` (with re-entry guard) + `process.on('SIGINT'|'SIGTERM')`. Currently registers a stub `GET /api/tasks` calling `listTasks()` directly — **Story 1.3 removes this stub in favour of the `routes/tasks.ts` plugin**.
- [server/src/db.ts](server/src/db.ts) — sole SQLite owner. Exports `listTasks`, `createTask`, `updateTask`, `deleteTask`, `closeDb`, and the `Task` type. `createTask` does `INSERT OR IGNORE` + in-transaction re-read → retries return the canonical stored row (AC6 is already structurally satisfied on the DB side). `updateTask` returns `null` on missing id (use this for the PATCH 404 path). `deleteTask` is idempotent (use this directly for AC11).
- The prod dep list is locked at 5/5: `react`, `react-dom`, `fastify`, `better-sqlite3`, `@fastify/static`. **Story 1.3 adds zero production dependencies** (ajv ships with Fastify core; pino ships with Fastify; `crypto.randomUUID` is built-in; `--env-file` is built-in to Node 24).

**Lessons from 1.1/1.2 to carry forward:**

- **ESM `.js` specifier is mandatory.** `import tasksRoutes from './routes/tasks.js'` (not `.ts`, not bare). `tsx` is lenient in dev but `node dist/server.js` throws `ERR_MODULE_NOT_FOUND` without it. Subtle footgun.
- **Named exports only from `db.ts`.** Story 1.3's route module should also prefer default export (Fastify plugin convention) + named helpers if any — but the plugin is the only thing crossing the boundary.
- **Defensive-coding style is established** (PORT range check, `reply.sent` guard, `shuttingDown` re-entry flag, pre-throw `mkdirSync`). Continue in that style — but do **not** gold-plate. Specifically: do not add try/catch around each handler just to log — Fastify's default error handler already does that correctly and uniformly.
- **Pre-existing gotchas** (do not re-introduce): do NOT chain `.catch()` on Fastify's `reply.sendFile()` (it does not return a Promise); use `async/await` + try/catch instead — this pattern was the inherited cleanup in Story 1.2.

### Architecture references and hard rules

[Source: architecture.md §API & Communication Patterns (AR10–AR14)]

- **REST over JSON.** Four endpoints, all under `/api/` prefix. No versioning segment (no `/v1/`).
- **Response shape is direct.** `GET /api/tasks` returns `Task[]` directly; `POST` returns the created `Task`. **No `{ data, meta }` envelope** (AR12).
- **Error shape is Fastify default.** `{ statusCode, error, message }`. **Do not customize** — do not write a `setErrorHandler` that reshapes errors, do not add an `errorCode` field, do not add `details`. Fastify's default already matches the spec.
- **Dates are epoch milliseconds (integer) everywhere** (AR13). DB column `created_at` is `INTEGER`, wire field `createdAt` is `number`, TS type is `number`. No ISO strings at any boundary.
- **Content type is `application/json` only.** When a route has a body schema, Fastify's default `application/json` content-type parser applies. Non-JSON content is rejected by the parser before the handler runs.
- **HTTP method correctness (NFR-S3, AR10):** each handler is bound to exactly one method via `app.get/post/patch/delete`. No dispatch-on-method inside a handler. Fastify's routing rejects unknown method+path combinations automatically.
- **Route file:** `server/src/routes/tasks.ts`. Register the plugin in `server.ts` with `{ prefix: '/api' }` — so inside the plugin the route paths are `/tasks` and `/tasks/:id` (not `/api/tasks`). This gives the "future auth preHandler attaches to the whole prefix in one place" seam (AR16).

[Source: architecture.md §Validation; PRD NFR-S1–S4]

- **Validation is Fastify's built-in JSON Schema via ajv.** ajv is shipped with Fastify core — **not an additional dep**. Schemas go alongside the route handlers (same file `routes/tasks.ts`), as plain JS objects passed via `{ schema: { body, params, querystring } }` in the route options. Fastify compiles them at route-registration time.
- **`additionalProperties: false`** on every body schema. This is what rejects extra unknown properties (AC4 "extra keys → 400").
- **UUID v4 validation via regex `pattern`.** Do **not** install `ajv-formats` for `"format": "uuid"` — this would add a dev dep and the regex is trivial. Use `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`. Same regex used for `body.id` (POST) and `params.id` (PATCH/DELETE). Both lowercase-only to match `crypto.randomUUID()` output.
- **Input validation in `db.ts` is forbidden** (preserved from Story 1.2). The route layer is the sole entry point for format validation; `db.ts` trusts its inputs and enforces only structural invariants (schema CHECK constraint, primary key uniqueness via `INSERT OR IGNORE`).

[Source: architecture.md §Authentication & Security (AR15); epics.md §Story 1.3 AC]

- **Security headers preHandler lives in `server/src/security.ts`.** Three headers, hand-rolled:
  - `Content-Security-Policy: default-src 'self'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: same-origin`
- **`onSend` hook** (not `onRequest`) so headers apply to all responses including errors, 404s, and static files served by `@fastify/static`. Implementation is ~10 lines. **No `@fastify/helmet` dependency.**
- **No CORS.** Same-origin deployment in production; Vite proxies `/api/*` in dev. Do not add CORS headers or a CORS plugin.
- **500 errors must not leak internals (NFR-S2, AC14).** Fastify's default error handler already sanitizes this — its default 500 response body is `{ statusCode: 500, error: 'Internal Server Error', message: '<genericized>' }` and it pino-logs the full error with stack at `error` level. Achieve this by **not overriding the error handler**. Do not write a custom `setErrorHandler` — the default is what AC14 demands.
- **No auth, no rate limiting, no HTTPS at the app layer** — all explicitly out of scope per PRD and AR16.

[Source: architecture.md §Logging; AR27]

- **Fastify's built-in pino logger.** Already configured in `server.ts` (`logger: { level: isProduction ? 'info' : 'debug' }`). Do not reconfigure.
- **Levels:** `error` for 5xx, `warn` for 4xx, `info` for request completion (Fastify default), `debug` for dev only.
- **Privacy hygiene (AC15, AR27):** never log task `text` at `info`. Concrete implication:
  - Do NOT write `app.log.info({ body: request.body }, 'post /api/tasks')` — this would serialize the task text into the info-level log.
  - Do NOT write `app.log.info(\`Created task: ${task.text}\`)`.
  - It IS OK to write `app.log.debug({ id: task.id, len: task.text.length }, 'task created')` — debug level is fine, and id/length are non-sensitive.
  - Fastify's default request/response logging does NOT include the body. Do not add a `serializer` that would.

[Source: architecture.md §Environment config; AR17]

- **`.env` loading via Node 24's built-in `--env-file` flag.** Do NOT install `dotenv`. Do NOT write a CLI arg parser. Do NOT hand-roll `.env` reading.
- **Scripts in `server/package.json`:**
  - `"dev": "tsx --env-file=.env src/server.ts"` — `tsx` passes `--env-file` through to Node.
  - `"start": "node --env-file=.env dist/server.js"`.
  - If a dev wants to skip `.env` in a one-off (e.g., running with inline env vars), `--env-file-if-exists=.env` is the silent variant — optional.
- **Variables:** `PORT` (default 3000) and `DB_PATH` (default `./data/tasks.db`). Defaults live in code (`server.ts` / `db.ts`), not in `.env`. `.env` is for overrides.
- **`.env.example` commits the two keys with safe defaults** so a fresh clone has a discoverable contract.
- **Precedence:** OS env > `.env` file > code defaults. Node 24's `--env-file` does not overwrite vars already present in the process environment — this matches standard `dotenv` semantics.

[Source: architecture.md §Service / Data Boundaries; AR31]

- **Import direction is strictly one-way:** `server.ts → routes/tasks.ts → db.ts`. Never the reverse.
- **`db.ts` is the only file that imports `better-sqlite3`.** Preserved from Story 1.2; grep-enforced (AC18).
- **snake_case column names never leak.** Route handlers see only the camelCase `Task` shape returned from `listTasks/createTask/updateTask`.

### Idempotency — the chain is already built

[Source: architecture.md §FR19, NFR-R3; epics.md AR9]

`INSERT OR IGNORE` on the DB side is already wired (Story 1.2's `db.createTask`). On retry with the same UUID:

1. `INSERT OR IGNORE` is a no-op at the row level.
2. The in-transaction `SELECT WHERE id = ?` reads the originally stored row.
3. `createTask` returns that canonical row to the route handler.
4. The handler returns it with status 201.

The route layer does **nothing special** to enable idempotency — it just forwards the canonical row. The client getting the original `text` back (not the retry's `text`) is the **documented contract** (Story 1.2 AC6, confirmed this story's AC6). Do not "fix" this in the route handler by detecting a duplicate and returning 409 — that would break NFR-R3.

`PATCH` and `DELETE` are idempotent by nature of their semantics (setting `completed` to the same value is a no-op; deleting a missing row is a no-op). AC11 requires DELETE to always return 204 regardless of whether a row existed — already structurally satisfied by `db.deleteTask`.

### Boilerplate sketches (non-normative — adapt but preserve the rules)

**`server/src/routes/tasks.ts`** — reference shape:

```ts
import type { FastifyInstance } from 'fastify';
import { listTasks, createTask, updateTask, deleteTask } from '../db.js';

// Duplicated locally per AR23 — do NOT import Task from db.ts.
interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

const UUID_V4 =
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

const createBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'text'],
  properties: {
    id: { type: 'string', pattern: UUID_V4 },
    text: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

const patchBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['completed'],
  properties: { completed: { type: 'boolean' } },
} as const;

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_V4 } },
} as const;

export default async function tasksRoutes(app: FastifyInstance) {
  app.get('/tasks', async (): Promise<Task[]> => listTasks());

  app.post<{ Body: { id: string; text: string } }>(
    '/tasks',
    { schema: { body: createBodySchema } },
    async (req, reply) => {
      const task = createTask(req.body);
      reply.code(201);
      return task;
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { completed: boolean };
  }>(
    '/tasks/:id',
    { schema: { params: idParamsSchema, body: patchBodySchema } },
    async (req, reply) => {
      const task = updateTask(req.params.id, { completed: req.body.completed });
      if (!task) {
        reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Task not found',
        });
        return;
      }
      return task;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/tasks/:id',
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      deleteTask(req.params.id);
      reply.code(204);
      return;
    },
  );
}
```

**`server/src/security.ts`** — reference shape:

```ts
import type { FastifyInstance } from 'fastify';

export default async function securityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('Content-Security-Policy', "default-src 'self'");
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    return payload;
  });
}
```

**`server/src/server.ts`** — new imports + registration order:

```ts
import tasksRoutes from './routes/tasks.js';
import securityHeaders from './security.js';

// ... existing PORT validation + Fastify init ...

await app.register(securityHeaders);            // global, first
await app.register(tasksRoutes, { prefix: '/api' });  // before static!

// REMOVE the old stub:
// app.get('/api/tasks', async () => listTasks());

if (isProduction) {
  // existing @fastify/static block stays as-is
}
```

**Anti-patterns (forbidden — see architecture.md §Pattern Examples):**

```ts
// ❌ Custom error handler that reshapes Fastify's default
app.setErrorHandler((err, req, reply) => reply.send({ ok: false, err: err.message }));

// ❌ Logging task text at info level
app.log.info({ body: req.body }, 'post /api/tasks');

// ❌ Installing a dep to validate UUIDs
import { validate as isUuid } from 'uuid';  // rejected — ajv pattern is enough

// ❌ Envelope response
return { data: tasks, meta: { count: tasks.length } };

// ❌ Importing better-sqlite3 in routes/tasks.ts
import Database from 'better-sqlite3';  // AR31 violation; grep will catch it

// ❌ Catching in the handler to log then re-throw (Fastify already does this)
try { ... } catch (err) { app.log.error(err); throw err; }

// ❌ dotenv
import 'dotenv/config';  // rejected — use --env-file

// ❌ Registering the static plugin before API routes (SPA fallback shadows /api/*)
await app.register(fastifyStatic, ...);
await app.register(tasksRoutes, { prefix: '/api' });  // TOO LATE — AR25
```

### `.env` / env-file — concrete guidance

Node 24's `--env-file=<path>` reads a `.env`-format file (KEY=VALUE, one per line, `#` comments allowed) and seeds `process.env`. Key semantics for this story:

- **Precedence:** pre-existing `process.env.FOO` **wins** over the file's `FOO=...`. This matches `dotenv`'s default behaviour and means Docker-style env injection keeps working.
- **Missing file:** `--env-file=.env` errors if `.env` does not exist. Use `--env-file-if-exists=.env` only if you need the silent variant. Spec default: the regular `--env-file` is fine — the dev starts by creating `.env` from `.env.example`.
- **No quoting magic:** Node's parser is minimal. Avoid complex shell expansion; `DB_PATH=./data/tasks.db` is fine, `DB_PATH="./data/tasks.db"` is accepted, but avoid `$VAR` references (not expanded).
- **tsx passes the flag through:** `tsx --env-file=.env src/server.ts` works identically to the Node equivalent.

### Things that are explicitly NOT in scope

Story 1.3 is the full HTTP/API surface. Out of scope for this story (belongs to later stories):

- **Any frontend change** → Stories 1.4+. No client-side fetch wrappers, no reducer, no components.
- **Automated tests** (`routes/tasks.test.ts`, `db.test.ts`) → Story 1.8. Do NOT create these files yet. Manual verification is Task 5.
- **Optimistic-UI state, connectivity banner, per-row error status** → Epic 2 (Stories 2.1–2.5). The server just serves canonical truth; the client owns optimistic UI.
- **Rate limiting, CORS, auth, HTTPS** — all PRD-excluded (NFR-S-series, AR16).
- **API documentation generator (OpenAPI / Swagger)** — explicitly rejected by architecture; the 4-endpoint surface is small enough for inline doc comments.
- **Request ID middleware / correlation IDs** — not in scope; pino's default request logger has `reqId` for this story's needs.
- **Custom error handler** (`setErrorHandler`) — AR15 / NFR-S2 / AC14 all say **use the default**; do not write one.

### AC-to-test matrix (for the dev's self-check at Task 5)

| AC | How to verify |
|----|---------------|
| AC1 | `curl http://localhost:3000/api/tasks` → 200 JSON array, headers include `Content-Type: application/json` + 3 security headers |
| AC2 | POST with valid UUID+text → 201 body is the task; `GET /api/tasks` now contains it |
| AC3 | POST `text` 201 chars → 400 Fastify shape; GET count unchanged |
| AC4 | POST missing `id`, missing `text`, `text:""`, non-UUID `id`, extra property → all 400 |
| AC5 | `curl -H 'Content-Type: text/plain' -X POST ... -d '...'` → 400/415 |
| AC6 | POST same UUID twice (diff text) → both 201, same body, `listTasks().length` unchanged between them |
| AC7 | PATCH existing id `{completed:true}` → 200 updated task; `createdAt` byte-identical to before |
| AC8 | PATCH nonexistent UUID → 404 Fastify shape |
| AC9 | PATCH `/api/tasks/not-a-uuid` → 400 from params schema |
| AC10 | DELETE existing → 204 empty body; subsequent GET confirms removal |
| AC11 | DELETE same id again → 204 (not 404) |
| AC12 | `GET /api/tasks/:id/delete` → 404; no handler runs |
| AC13 | `curl -sI` on `/api/tasks`, `/`, `/nonexistent` → all three headers present on all |
| AC14 | Force a throw in a handler, curl, confirm response body has no stack/path/SQL; pino log at error level has full error |
| AC15 | POST with distinctive text; `grep` info-level log lines for that text → 0 matches |
| AC16 | Set `PORT=3001` in `.env`, `npm --prefix server run dev` → server logs show port 3001; unset env var reverts to 3000 |
| AC17 | Read `server/src/server.ts`; confirm `tasksRoutes` registered before `fastifyStatic` |
| AC18 | `grep -R "better-sqlite3" server/src/` → 1 match; `grep -RE "created_at\|snake_case" server/src/` → 1 match |

### Project Structure Notes

After this story, `server/src/` will be:

```
server/src/
├── server.ts          ← edited (register security + tasks plugin, remove stub route)
├── db.ts              ← unchanged from Story 1.2
├── security.ts        ← NEW (onSend hook, 3 headers)
└── routes/
    └── tasks.ts       ← NEW (4 handlers + 3 schemas)
```

And `server/`:

```
server/
├── package.json       ← edited (dev/start scripts updated with --env-file)
├── .env.example       ← NEW (committed)
├── .env               ← gitignored (dev creates locally)
├── tsconfig.json      ← unchanged
└── data/.gitkeep      ← unchanged
```

No changes to `client/`. No new directories beyond `server/src/routes/`. No `server/src/middleware/` or `server/src/plugins/` — the security hook is small enough to live in `security.ts` at the top level per architecture doc §Source Tree.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Task REST API (GET/POST/PATCH/DELETE)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 → Architectural Requirements AR10–AR17, AR25, AR27, AR31]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment]
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — Error-handling hierarchy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Service / Data Boundaries — backend import direction]
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping → FR Category 1 + FR Category 4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern Examples]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-S1, NFR-S2, NFR-S3, NFR-S4, NFR-R3]
- [Source: _bmad-output/implementation-artifacts/1-2-task-persistence-layer-sqlite-schema-repository.md#Completion Notes List]
- [Source: _bmad-output/implementation-artifacts/1-1-project-scaffold-orchestration.md#Completion Notes List]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **AC1–AC12 sweep:** scripted curl harness produced 30 PASS / 0 FAIL after the two ajv customizations were added (`removeAdditional: false` + `coerceTypes: false`). Without `coerceTypes: false`, payload `{"id":"<valid-uuid>","text":1}` returned 201 because ajv coerced `1` → `"1"` and the pattern check passed; with it, the same payload returns 400. Same story for the extra-property case before `removeAdditional: false`.
- **AC13 (security headers):** verified via `curl -sS -D-` against `/api/tasks` (200), `/api/nonexistent` (404), and `/` (404). All three headers (`Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`) appear on every response. **Initial run failed** because `app.register(securityHeaders)` encapsulated the hook to the plugin's child context — sibling plugins (the tasks-routes plugin) never received it. Fix was to switch from `app.register(securityHeaders)` to a direct call `registerSecurityHeaders(app)`. See `src/security.ts` comment for the full rationale (avoiding `fastify-plugin` to keep the prod-dep count at 5/5).
- **AC14 (no 500 leak):** temporarily added `app.get("/__leak_test__")` that throws an Error with a fake "secret" path in the message; curl response body had `statusCode/error/message` only — **no stack trace**, no file paths beyond what the message contained. Server-side pino log at `level: 50` contained the full Error including stack. Removed the leak_test route before commit. **Open item:** Fastify's default error handler echoes `err.message` to the response body. Story explicitly forbade `setErrorHandler` overrides. Our actual handlers don't throw messages with secrets (only `db.ts` throws `createTask: row {id} missing after INSERT OR IGNORE` — id is the client-supplied UUID, not a leak). Flagged for code review.
- **AC15 (no task text at info):** ran POST with `text: "buy bread"` and `text: "NEW text"`; `grep '"level":30' <log> | grep -c <text>` returned 0 in both cases. Fastify's default request logger at info logs only `method`, `url`, `host`, `remoteAddress`, `remotePort`, `reqId` — no body. We never call `app.log.info(...)` with task text in any code path.
- **AC16 (.env via --env-file-if-exists):** wrote `server/.env` with `PORT=4320\nDB_PATH=./data/verify-env.db`, started server, boot log confirmed listening on 4320, and `data/verify-env.db` appeared on disk. Removed `.env`, restarted: server fell back to code defaults (PORT=3000, DB_PATH=./data/tasks.db).
- **AC17 (route order):** `grep -n` on `server.ts` shows `registerSecurityHeaders(app)` at line 41 → `app.register(tasksRoutes, { prefix: "/api" })` at line 45 → `app.register(fastifyStatic, ...)` at line 59 → `app.setNotFoundHandler(...)` at line 63. API routes register before static.
- **AC18 (boundary):** `grep -R 'better-sqlite3' server/src/` → 1 match (`db.ts:1`). `grep -RE 'created_at|snake_case' server/src/` → 7 matches, all in `db.ts`. `routes/tasks.ts` imports via `../db.js` (NodeNext-correct).
- **Typecheck + build:** `tsc --noEmit` → 0 errors. `tsc` (build) → 0 errors. `dist/db.js`, `dist/routes/tasks.js`, `dist/security.js`, `dist/server.js` all emitted.

### Completion Notes List

**REST API + security headers + .env wiring shipped.** All 18 ACs satisfied. Server is now serving the canonical 4-endpoint surface (`GET/POST/PATCH/DELETE /api/tasks`) with ajv-validated input, idempotent writes via the existing `db.ts` repository, and three security headers on every response.

**Key implementation decisions:**

- **Ajv strict mode (`removeAdditional: false`, `coerceTypes: false`).** Fastify 5's default ajv silently strips unknown properties and coerces scalar types. Both behaviors broke AC4 — extra keys were accepted, and `text: 1` was coerced to `"1"` and stored. Adding the two `customOptions` toggles was the smallest fix; both options apply project-wide so all current and future routes inherit strict validation.

- **Direct registration of security headers (not a Fastify plugin).** Fastify plugin encapsulation prevented the `onSend` hook from firing on sibling plugins' routes. The two no-dep options were (a) wrap with `fastify-plugin` (rejected — new prod dep would break the 5/5 NFR-M1 cap) or (b) skip the encapsulation by calling the registration function directly on the root app instance. Chose (b). The spec sketch showed `app.register(securityHeaders)` but the sketch was marked "non-normative — adapt but preserve the rules"; the rule (headers on every response) is preserved, the technique adapted.

- **`--env-file-if-exists` over `--env-file`.** Spec said "Node 24 warns but continues when .env is missing" — that's incorrect. Plain `--env-file=.env` is a hard error if the file is missing. AC16 requires defaults to apply when `.env` is absent, so the `-if-exists` variant is the only correct choice. Verified both presence (PORT/DB_PATH from `.env`) and absence (code defaults) paths.

- **`setErrorHandler` left at Fastify default.** Followed the spec rule. Trade-off: Fastify's default 5xx response echoes `err.message` to the client. Documented in the AC14 caveat above; flagged for code review whether to harden 5xx responses with a minimal handler that genericizes `message`.

- **POST/POST-retry status code = 201, both.** Spec said "200 or 201 — consistent across endpoints". Picked 201 for both first-write and idempotent retry — the row is canonically present after either, and 201 reflects the resource-creation semantic. Easier client logic than splitting 201/200 by retry detection.

- **No new prod deps.** ajv ships with Fastify; pino ships with Fastify; `crypto.randomUUID()` and `--env-file-if-exists` are Node 24 built-ins; UUID validation is a regex `pattern` (not `ajv-formats`). Server prod deps still: `fastify`, `better-sqlite3`, `@fastify/static`. Project at 5/5 NFR-M1 cap.

- **No tests written.** Story 1.8 territory; manual curl verification per Task 5. The harness output (30 PASS / 0 FAIL) is captured in the Debug Log above for reproducibility.

**Boundary discipline (AC18) preserved.** Routes module never imports `better-sqlite3`. Snake_case never leaks beyond `db.ts`. Import direction is one-way: `server.ts → routes/tasks.ts → db.ts`. ESM `.js` specifier used everywhere.

**Cleanup:** removed temp `/__leak_test__` route, removed temp `server/.env`, removed test DB files (`data/verify-1-3.db*`, `data/verify-env.db*`, `data/tasks.db*`). `data/.gitkeep` preserved; runtime DB files gitignored.

**Enhanced DoD checklist:**
- ✅ All 6 tasks + all subtasks `[x]`
- ✅ All 18 ACs verified (curl harness for AC1–AC13, manual leak/log/env probes for AC14–AC16, file inspection for AC17–AC18)
- ✅ No regressions: Story 1.1's static-serving path and Story 1.2's repository contract still pass (GET 200, list shape correct, idempotency held)
- ✅ `tsc --noEmit` clean
- ✅ `tsc` build clean; `dist/routes/tasks.js` + `dist/security.js` emitted with sourcemaps
- ✅ File List complete (see below)
- ✅ Only permitted story sections modified (Status, task checkboxes, Dev Agent Record, File List, Change Log)
- ⏸ Automated tests deferred to Story 1.8 per story scope

### File List

**New files:**

- `server/src/routes/tasks.ts` — Fastify plugin with 4 handlers (GET/POST/PATCH/DELETE /tasks) + 3 JSON schemas (`createBodySchema`, `patchBodySchema`, `idParamsSchema`) + locally-duplicated `Task` interface. ~85 LOC.
- `server/src/security.ts` — `registerSecurityHeaders(app)` direct-registration function; adds an `onSend` hook setting CSP, `X-Content-Type-Options`, `Referrer-Policy` on every response. ~20 LOC including rationale comment.
- `server/.env.example` — committed env template with `PORT=3000` and `DB_PATH=./data/tasks.db`.

**Edited files:**

- `server/src/server.ts` — three localized changes:
  1. Replaced `import { closeDb, listTasks }` with `import { closeDb }`; added `import tasksRoutes from "./routes/tasks.js"` and `import registerSecurityHeaders from "./security.js"`.
  2. Removed the stub `app.get("/api/tasks", async () => listTasks())` route. Replaced with `registerSecurityHeaders(app);` followed by `await app.register(tasksRoutes, { prefix: "/api" });` — both before the conditional `@fastify/static` block.
  3. Added `ajv: { customOptions: { removeAdditional: false, coerceTypes: false } }` to the Fastify constructor options.
- `server/package.json` — `dev` and `start` scripts updated to use `--env-file-if-exists=.env`.

**Generated / ignored artifacts (not committed):**

- `server/dist/routes/tasks.js`, `server/dist/security.js` — `tsc` emit (gitignored).
- `server/data/tasks.db` etc. — runtime SQLite files (gitignored).

**No files removed.**

## Change Log

| Date       | Version | Description                                                                                                                                                  | Author             |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 2026-04-27 | 0.3.0   | Story 1.3 implementation: REST API (GET/POST/PATCH/DELETE) under /api/tasks with ajv validation, idempotent retries, security-headers preHandler, --env-file wiring. | Amelia (dev agent) |
