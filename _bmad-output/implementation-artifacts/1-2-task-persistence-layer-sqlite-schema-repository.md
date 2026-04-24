# Story 1.2: Task Persistence Layer (SQLite + Schema + Repository)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a durable SQLite persistence layer with a typed repository interface,
So that the server can reliably read and write tasks with guaranteed schema constraints and idempotency.

## Acceptance Criteria

1. **Schema bootstrap (AC1):** Given the server starts cold against an empty or missing database file, when initialization runs, **then** a `tasks` table is created idempotently via `CREATE TABLE IF NOT EXISTS` with columns `id TEXT PRIMARY KEY`, `text TEXT NOT NULL CHECK (length(text) <= 200)`, `completed INTEGER NOT NULL DEFAULT 0`, `created_at INTEGER NOT NULL`, **and** index `idx_tasks_created_at` on `created_at` is created (also idempotently), **and** `PRAGMA journal_mode=WAL` is enabled, **and** `PRAGMA synchronous=FULL` is enabled (fsync on commit per NFR-R1 durability).
2. **Data-dir auto-create (AC2):** Given the server data directory does not exist at startup, when initialization runs, **then** the server creates the directory (recursively) before opening the SQLite file. No `ENOENT` crash on a clean clone where only `server/data/.gitkeep` exists.
3. **Empty list (AC3):** Given an empty database, when `listTasks()` is called, **then** it returns `[]` (an empty array, not `null`/`undefined`).
4. **Ordered list shape (AC4):** Given three tasks inserted with distinct `created_at` values, when `listTasks()` is called, **then** the returned array is ordered by `created_at ASC` (oldest first), **and** each element has shape `{ id: string, text: string, completed: boolean, createdAt: number }` — camelCase keys, boolean (not 0/1), epoch milliseconds integer. No `created_at` key in the returned objects.
5. **Create sets server-side timestamp (AC5):** Given `createTask({ id, text })` is called with a fresh UUID, when the row is inserted, **then** `created_at` is set server-side to `Date.now()` at insert time (not by the caller), **and** the returned object has that `createdAt` value.
6. **Create is idempotent (AC6):** Given `createTask({ id, text })` is called with an id that already exists (retry scenario), when the insert executes via `INSERT OR IGNORE`, **then** no new row is created, **and** the existing stored task is returned unchanged (original `text` and `createdAt` preserved, even if the retry used different `text`).
7. **Update preserves createdAt (AC7):** Given an existing task, when `updateTask(id, { completed: true })` is called, **then** `completed` is set to 1 in the DB (and serialized as `true` in the return value), **and** `created_at` is unchanged (FR15 — immutable creation timestamp). Returns the updated task; returns `null` (or equivalent sentinel) if the id doesn't exist.
8. **Delete existing (AC8):** Given a task with id X exists, when `deleteTask(X)` is called, **then** the row is removed.
9. **Delete missing is idempotent (AC9):** Given no task with id X exists, when `deleteTask(X)` is called, **then** no error is thrown (idempotent delete — caller cannot tell from the return value whether a row existed).
10. **Durability across restart (AC10):** Given tasks were written and the server process is killed (not cleanly — e.g., `kill -9`), when the server restarts and `listTasks()` is called, **then** the same tasks are returned. NFR-R1 (zero data loss across restart) verified end-to-end on a real SQLite file.
11. **Boundary discipline (AC11):** Given the repository module, when I inspect imports across the server package, **then** `better-sqlite3` is imported **only** in `server/src/db.ts`, **and** snake_case ↔ camelCase conversion happens only in that file. No other server module touches the SQLite API or sees snake_case column names.

## Tasks / Subtasks

- [x] **Task 1 — Create `server/src/db.ts` with DB open + schema init + pragmas** (AC: 1, 2, 11)
  - [x] Import `better-sqlite3` as the default import (`import Database from 'better-sqlite3'`) — this is the **only** file in the server package that imports it.
  - [x] Read `DB_PATH` from `process.env.DB_PATH`, default to `./data/tasks.db` (relative to the server's cwd — which at runtime is the `server/` directory per the npm script setup). Per story 1.3's AC, `.env` loading via `--env-file` is Story 1.3's concern; for Story 1.2, reading directly from `process.env` + defaulting is sufficient and forward-compatible.
  - [x] Before opening the DB, call `mkdirSync(dirname(dbPath), { recursive: true })` (from `node:fs`) to satisfy AC2. Wrap in a try/catch that logs a clear error and re-throws — failures here are fatal for server startup.
  - [x] Open the DB via `new Database(dbPath)` (synchronous open — `better-sqlite3`'s design).
  - [x] Apply pragmas in order: `db.pragma('journal_mode = WAL')`, `db.pragma('synchronous = FULL')`. WAL+FULL gives per-commit fsync (NFR-R1). Do **not** set `synchronous=NORMAL` — that trades durability for throughput and this product's budget has room for FULL.
  - [x] Run schema bootstrap via `db.exec(...)`, both statements `IF NOT EXISTS` for idempotent re-init.
  - [x] DB connection held as a module-level singleton inside `db.ts`; not exported — only the repository functions cross the module boundary.
  - [x] Export a `closeDb()` function that calls `db.close()` — `server.ts` needs this for graceful shutdown.
- [x] **Task 2 — Implement the four repository functions in `db.ts`** (AC: 3, 4, 5, 6, 7, 8, 9, 11)
  - [x] Define a local `Task` type (exported) with shape `{ id: string; text: string; completed: boolean; createdAt: number }` — camelCase, boolean, epoch-ms integer. Also define a private `TaskRow` type `{ id: string; text: string; completed: number; created_at: number }` used **only** inside `db.ts` as the raw shape read from SQLite.
  - [x] Implement `listTasks(): Task[]` — prepared SELECT with explicit columns (no `SELECT *`), ordered `created_at ASC`, mapped through `rowToTask` (Boolean cast + createdAt rename).
  - [x] Implement `createTask(input: { id: string; text: string }): Task` with `INSERT OR IGNORE` + in-transaction re-read so retries return the canonical stored row.
  - [x] Implement `updateTask(id: string, patch: { completed: boolean }): Task | null` — SET clause names only `completed` (FR15 enforced structurally); returns `null` on missing id.
  - [x] Implement `deleteTask(id: string): void` — idempotent, ignores `info.changes`.
  - [x] Export all four functions + `closeDb` + the `Task` type from `db.ts`. No default export — named exports only.
- [x] **Task 3 — Wire DB init + graceful close into `server.ts`** (AC: 1, 2, 10, 11)
  - [x] Added `import { closeDb, listTasks } from "./db.js";` — `.js` specifier for NodeNext ESM.
  - [x] Updated `gracefulShutdown(sig)` to call `closeDb()` in an inner try/catch after `await app.close()`.
  - [x] Updated stub route `app.get("/api/tasks", async () => listTasks());` — exercises the real repository so AC10 can be verified end-to-end.
  - [x] No `better-sqlite3` import added to `server.ts` (AC11).
  - [x] No new `routes/` or `security.ts` files (Story 1.3 scope).
  - [x] **Inherited cleanup:** fixed three pre-existing TypeScript errors in `server.ts` that Story 1.1's post-review lint pass introduced (misplaced `.catch()` on `sendFile`, implicit `any` on shutdown handler, `err` typed `unknown` in graceful-shutdown handler). See Completion Notes for rationale.
- [x] **Task 4 — Verify schema bootstrap and idempotency** (AC: 1, 2)
  - [x] With `server/data/tasks.db` absent, `npm --prefix server run dev` produced `server/data/tasks.db`, `tasks.db-shm`, `tasks.db-wal` automatically; server started without error.
  - [x] `sqlite3 server/data/tasks.db ".schema"` shows `tasks` table + `idx_tasks_created_at` index.
  - [x] Pragmas verified on the db.ts-equivalent connection (not the CLI, since `PRAGMA synchronous` is per-connection): `journal_mode=wal`, `synchronous=2` (FULL).
  - [x] Restart against existing DB file — clean re-init, no errors.
  - [x] `rm -rf server/data && npm --prefix server run dev` — directory re-created, DB initializes cleanly.
- [x] **Task 5 — Verify repository behavior and durability** (AC: 3–10)
  - [x] 13/13 repository assertions passed via `tsx verify-repo.mts` (throwaway script, removed after run): AC3 empty list, AC4 shape+ordering, AC5 server-side createdAt, AC6 idempotent create (retry returns original), AC7 update-completed-only + null on missing, AC8 delete existing, AC9 delete idempotent.
  - [x] AC10 durability: seeded 3 tasks via clean-close script, started server, `kill -9` the tsx child, reopened DB in a fresh process → all tasks present. Combined with 2 tasks still in the DB from the AC3–AC9 sequence, all 5 survived the hard kill.
  - [x] HTTP-level AC11 check: `curl` against the running server returned JSON with `createdAt` (camelCase), `completed` as boolean, no `created_at` leakage (`grep -c created_at` on response body = 0).
- [x] **Task 6 — Verify AC11 boundary discipline + typecheck** (AC: 11)
  - [x] `grep -R "better-sqlite3" server/src/` → exactly one match: `server/src/db.ts`.
  - [x] `grep -RE "created_at|snake_case" server/src/` → exactly one match: `server/src/db.ts`.
  - [x] `tsc --noEmit` → zero errors (after fixing pre-existing server.ts issues in Task 3).
  - [x] `npm run build` → clean emit, `server/dist/db.js` + `server/dist/server.js` both present.

### Review Findings

- [x] [Review][Patch] `reply.sent` guard missing in SPA fallback 500 path [server/src/server.ts:56-67] — fixed: wrapped the `reply.code(500).send(...)` in `if (!reply.sent)` so a mid-stream `sendFile` failure no longer triggers `FST_ERR_REP_ALREADY_SENT`.
- [x] [Review][Patch] `DB_PATH=""` empty-string bypasses default [server/src/db.ts:20] — fixed: switched from `??` to `||` so empty-string `DB_PATH` now falls back to the default.
- [x] [Review][Patch] `gracefulShutdown` has no re-entry guard [server/src/server.ts:72-92] — fixed: added module-level `shuttingDown` flag; repeat signals now log and early-return instead of re-entering `app.close()` / `closeDb()`.
- [x] [Review][Defer] `app.listen` failure + `app.close()` reject path skip `closeDb()` [server/src/server.ts:83-88, 99-104] — deferred, pre-existing Story 1.1 shape; leaks WAL/SHM file handles on rare boot/shutdown error paths. Low impact for MVP single-user.
- [x] [Review][Defer] `updateTask` TOCTOU between UPDATE and re-read [server/src/db.ts:97-105] — deferred; single-user MVP makes the race essentially impossible. Wrap UPDATE + re-read in a `db.transaction` when concurrency arrives.
- [x] [Review][Defer] `Date.now()` millisecond ties break deterministic ordering [server/src/db.ts:46, 91] — deferred; tie-break collision impossible at single-user typing cadence. Add `ORDER BY created_at ASC, id ASC` if collisions ever surface.
- [x] [Review][Defer] No `busy_timeout` pragma [server/src/db.ts:32-33] — deferred; defaults to 0, so any future contention raises `SQLITE_BUSY` immediately. Set to ~5000ms when concurrency appears.
- [x] [Review][Defer] `unhandledRejection` handler does not trigger DB shutdown [server/src/server.ts:95-97] — deferred, pre-existing Story 1.1 shape; handler only logs.
- [x] [Review][Defer] Final `app.log.info` may be dropped before `process.exit(0)` [server/src/server.ts:81-82] — deferred, pre-existing Story 1.1 shape; pino is async and the last shutdown-success log can be lost on exit.

## Dev Notes

### Story context (what just shipped in Story 1.1)

Story 1.1 (`1-1-project-scaffold-orchestration`) is **done** and committed (`0fc01a8`). That story produced:

- Two-package flat layout (`client/` + `server/`) with a zero-prod-dep root orchestrator.
- `server/src/server.ts` on Fastify 5 + ESM/NodeNext, with a stub `GET /api/tasks` returning `[]`, conditional `@fastify/static` + SPA fallback in production, PORT validation, graceful shutdown via `gracefulShutdown(sig)` (calling `app.close()` then `process.exit`), and `process.on('unhandledRejection', ...)`.
- `server/data/.gitkeep` reserving the SQLite runtime directory.
- Prod deps locked at 5/10 on NFR-M1: `react`, `react-dom`, `fastify`, `better-sqlite3`, `@fastify/static`. `better-sqlite3@^12.9.0` and `@types/better-sqlite3@^7.6.13` are already installed; **do not re-install**.

**This story (1.2) is the second foundation story.** No HTTP-level validation or routing structure is in scope — that is Story 1.3. Story 1.2's output is a single new file (`server/src/db.ts`) and a small wire-up edit to `server.ts`.

**Lessons from Story 1.1 worth carrying forward:**

- **ESM import specifiers MUST include `.js`.** The server package is `"type": "module"` with `"module": "NodeNext"`. When importing `./db.ts` from `./server.ts`, the specifier must be `'./db.js'` (the emitted file), not `'./db.ts'` and not `'./db'`. TypeScript's NodeNext resolution expects the `.js` extension in the specifier even though the file-on-disk is `.ts`. Getting this wrong breaks at runtime, not compile time — `tsx` is lenient but `node dist/server.js` will throw `ERR_MODULE_NOT_FOUND`.
- **better-sqlite3 is CommonJS.** With `esModuleInterop: true` (already set in `server/tsconfig.json`), `import Database from 'better-sqlite3'` gives you the default-exported class. Do not use `import * as Database` — that returns the namespace wrapper and calling `new Database(...)` on it will fail.
- **Defensive-coding style is established.** Story 1.1's code-review pass added PORT range validation, `existsSync` checks, `unhandledRejection` handlers, and shutdown-timeout force-kills. Continue in that style where it prevents real crashes — but don't gold-plate (e.g., don't add retry loops for DB open; a failed DB open is fatal and should exit immediately).

### Architecture references and hard rules

[Source: architecture.md §Data Architecture; epics.md §Epic 1 AR6–AR9]

- **Schema** is fixed:
  ```sql
  CREATE TABLE IF NOT EXISTS tasks (
    id         TEXT PRIMARY KEY,         -- client-generated UUID v4
    text       TEXT NOT NULL CHECK (length(text) <= 200),
    completed  INTEGER NOT NULL DEFAULT 0,  -- 0|1 (SQLite has no bool)
    created_at INTEGER NOT NULL            -- Unix epoch ms, set server-side at first insert
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  ```
- **No migration framework.** Ever. `CREATE TABLE IF NOT EXISTS` is the migration strategy. If the schema ever changes post-MVP, the change-ticket adds a tiny sequential-step migration file at the top of `db.ts`; do not preemptively install Prisma, Drizzle, Knex, or `sqlite-migrations`.
- **Idempotency key = client UUID.** `INSERT OR IGNORE` is the server-side enforcement. The UUID is opaque to the server — do **not** validate it as UUID v4 inside `db.ts`; input validation is the route layer's job (Story 1.3, via ajv).
- **Dates: epoch milliseconds everywhere.** `created_at` is an `INTEGER` in SQLite, an `Int` on the wire (`createdAt`), a `number` in TypeScript. No ISO strings ever cross a boundary. Human-readable formatting lives at the render layer only.
- **Booleans: `0` / `1` in SQLite, `true` / `false` on the wire and in TS.** Conversion happens **only** in `db.ts` (`Boolean(row.completed)` on read, `completed ? 1 : 0` on write).

[Source: architecture.md §Naming Patterns → Database / API / Code]

- **SQL identifiers are snake_case and lowercase.** Table: `tasks`. Columns: `id`, `text`, `completed`, `created_at`. Index: `idx_tasks_created_at`. Never use camelCase or PascalCase inside SQL strings.
- **The DB module is the sole snake_case ↔ camelCase boundary.** Outside `db.ts`, no code ever sees `created_at`. This is **AC11** — it's testable by grep.
- **TypeScript names:**
  - Types: PascalCase — `Task`, `TaskRow`. No `I`-prefix (`ITask` is forbidden).
  - Functions: camelCase verbs — `listTasks`, `createTask`, `updateTask`, `deleteTask`, `closeDb`.
  - The module file is `db.ts` (lowercase, camelCase-style), matching the architecture's filename convention for non-component TS modules.

[Source: architecture.md §Service / Data Boundaries]

- **Import direction is strictly one-way.** `server.ts → routes/ → db.ts`. `db.ts` must **not** `import` anything from `server.ts`, `routes/`, or Fastify itself. It knows only about SQLite and the `Task` shape. Think of it as a library that happens to live in this package — it should be reusable without the HTTP layer.
- **`db.ts` is the ONLY file that imports `better-sqlite3`.** Grep will enforce this post-implementation (AC11).

### Durability — why WAL + FULL synchronous

[Source: architecture.md §Data Architecture + §Requirements to Structure Mapping → FR12–FR15; epics.md §Epic 1 AR8]

SQLite's default is `journal_mode=DELETE` + `synchronous=FULL`. That's safe but slow. `journal_mode=WAL` (Write-Ahead Logging) gives much better concurrent-read performance and crash safety, but its default paired `synchronous=NORMAL` mode only fsyncs at WAL checkpoints, not on every commit — that can lose the last few seconds of writes if the OS panics.

We set `PRAGMA synchronous=FULL` alongside WAL to get fsync on every commit. That's the combination NFR-R1 demands ("zero data loss across 14-day continuous-use test"). The cost is ~1ms of fsync latency per commit, which at this product's traffic (single user, a handful of writes per session) is invisible.

Do **not** set `synchronous=NORMAL` for perceived speed. Do **not** set `synchronous=OFF` ever — that defeats the whole point.

### Boilerplate sketch (non-normative — adapt but preserve the rules)

Below is a reference shape. The Story's ACs are authoritative; if the sketch disagrees with an AC, the AC wins.

```ts
// server/src/db.ts
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TaskRow {
  id: string;
  text: string;
  completed: number;
  created_at: number;
}

const DEFAULT_DB_PATH = './data/tasks.db';
const dbPath = resolve(process.env.DB_PATH ?? DEFAULT_DB_PATH);

try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch (err) {
  console.error(`Failed to create DB directory ${dirname(dbPath)}: ${(err as Error).message}`);
  throw err;
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         TEXT PRIMARY KEY,
    text       TEXT NOT NULL CHECK (length(text) <= 200),
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
`);

const selectAllStmt = db.prepare(
  'SELECT id, text, completed, created_at FROM tasks ORDER BY created_at ASC',
);
const selectOneStmt = db.prepare(
  'SELECT id, text, completed, created_at FROM tasks WHERE id = ?',
);
const insertStmt = db.prepare(
  'INSERT OR IGNORE INTO tasks (id, text, completed, created_at) VALUES (?, ?, 0, ?)',
);
const updateStmt = db.prepare(
  'UPDATE tasks SET completed = ? WHERE id = ?',
);
const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
  };
}

export function listTasks(): Task[] {
  const rows = selectAllStmt.all() as TaskRow[];
  return rows.map(rowToTask);
}

const createTxn = db.transaction((id: string, text: string, now: number): Task => {
  insertStmt.run(id, text, now);
  const row = selectOneStmt.get(id) as TaskRow | undefined;
  if (!row) throw new Error(`createTask: row ${id} missing after INSERT OR IGNORE`);
  return rowToTask(row);
});

export function createTask(input: { id: string; text: string }): Task {
  return createTxn(input.id, input.text, Date.now());
}

export function updateTask(
  id: string,
  patch: { completed: boolean },
): Task | null {
  const info = updateStmt.run(patch.completed ? 1 : 0, id);
  if (info.changes === 0) return null;
  const row = selectOneStmt.get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function deleteTask(id: string): void {
  deleteStmt.run(id);
}

export function closeDb(): void {
  db.close();
}
```

Anti-patterns (forbidden — see architecture.md §Pattern Examples):

```ts
// ❌ snake_case leaking out of db.ts
return { id: row.id, text: row.text, completed: row.completed, created_at: row.created_at };

// ❌ allowing UPDATE to touch created_at
'UPDATE tasks SET completed = ?, created_at = ? WHERE id = ?'  // WRONG — breaks FR15

// ❌ reading completed as number outside db.ts
if (task.completed === 1) { ... }  // WRONG — `completed` must be boolean outside db.ts

// ❌ SELECT *
db.prepare('SELECT * FROM tasks ...')  // WRONG — silent schema-drift footgun

// ❌ importing better-sqlite3 in any file other than db.ts
// server/src/server.ts, server/src/routes/*.ts — all forbidden

// ❌ introducing a migration framework
// npm install prisma / drizzle-kit / knex / sqlite-migrations — all rejected preemptively
```

### Wiring into `server.ts`

[Source: architecture.md §Service / Data Boundaries; architecture.md §Data Flow for "add task"]

The current `server.ts` (post-1.1 linting) has the shape:

```ts
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
// ... PORT validation, Fastify bootstrap ...

app.get("/api/tasks", async () => {
  return [];
});

if (isProduction) { /* @fastify/static + SPA fallback */ }

const gracefulShutdown = async (sig) => {
  app.log.info(`Received ${sig}; closing server gracefully...`);
  try {
    await app.close();
    // ← add closeDb() here
    app.log.info("Server closed successfully");
    process.exit(0);
  } catch (err) { /* ... */ }
};
```

**Your edits to `server.ts` are small and localized:**

1. At the import block, add `import { closeDb, listTasks } from "./db.js";` — quotes match existing file's style (double quotes after Prettier pass).
2. Replace the stub route body `return [];` with `return listTasks();`. The handler remains `async` for consistency even though `listTasks` is synchronous (better-sqlite3).
3. In `gracefulShutdown`, after `await app.close();` add:
   ```ts
   try {
     closeDb();
   } catch (dbErr) {
     app.log.error({ err: dbErr }, "Error closing DB during shutdown");
   }
   ```
   Then continue to `process.exit(0)`.

**Do not** restructure `server.ts`. Do not move the static-serving block. Do not add new routes — Story 1.3 does that.

### `.env` / env vars — scope boundary

[Source: architecture.md §Environment config; epics.md §Story 1.3 AC14]

Story 1.3's AC14 says `PORT` and `DB_PATH` are read from `.env` via Node 24's `--env-file` flag. **That work is Story 1.3's**, not Story 1.2's. For now:

- `db.ts` reads `process.env.DB_PATH` and falls back to `./data/tasks.db`. If the dev later runs `node --env-file=.env dist/server.js`, Node 24 will populate `process.env.DB_PATH` before `db.ts` executes; if they don't, the default kicks in. Either way Story 1.2 works.
- Do not install `dotenv`. Do not add any `.env` parsing logic. Do not add a CLI arg parser.

### Testing scope for this story

[Source: architecture.md §Testing Strategy]

**Still no automated tests** — the `node:test`-based `db.test.ts` file is introduced in **Story 1.8**. Task 5 in this story is a manual verification via `tsx` (ad-hoc commands, no committed script). Do **not** create `server/src/db.test.ts` yet. Do not wire the root `test` script to anything — it stays the placeholder from Story 1.1.

### Things that are explicitly NOT in scope

Story 1.2 is laser-focused on the repository. Do **not** do any of these (each belongs to a specific later story):

- **HTTP routes `POST / PATCH / DELETE /api/tasks`** → Story 1.3.
- **Security headers preHandler (`security.ts`)** → Story 1.3.
- **Request validation via ajv / JSON Schema** → Story 1.3.
- **`.env` loading via `--env-file`** → Story 1.3.
- **Any frontend change** → Stories 1.4+.
- **`server/src/db.test.ts` or any Vitest/node:test files** → Story 1.8.
- **Creating `server/src/routes/` directory** → Story 1.3.

### AC-to-test matrix (for the dev's self-check at Task 4 / Task 5)

| AC   | How to verify                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| AC1  | `sqlite3 data/tasks.db ".schema"` shows table + index; `PRAGMA journal_mode` = `wal`; `PRAGMA synchronous` = `2`.            |
| AC2  | `rm -rf server/data && npm --prefix server run dev` — server starts clean, re-creates dir + DB.                             |
| AC3  | `tsx -e 'import("./server/src/db.ts").then(m => console.log(m.listTasks()))'` on empty DB → `[]`.                           |
| AC4  | Three seeded tasks; `listTasks()` result is ordered ASC by createdAt; shape is `{id,text,completed,createdAt}` — no `created_at`. |
| AC5  | `createTask(...)` returned object's `createdAt` equals `Date.now()` captured before the call (±few ms).                      |
| AC6  | `createTask({id: same, text: different})` on existing id → returns original stored task; `listTasks().length` unchanged.     |
| AC7  | `updateTask(id, {completed:true})` — re-read row's `created_at` column matches pre-update value exactly.                    |
| AC8  | `deleteTask(existingId)` → `listTasks()` no longer contains it.                                                             |
| AC9  | `deleteTask(missingId)` → no throw, function returns normally.                                                              |
| AC10 | Seed tasks, `kill -9` the server, restart, `listTasks()` returns seeded tasks.                                              |
| AC11 | `grep -R "better-sqlite3" server/src/` → one match (db.ts). `grep -RE "created_at|snake_case" server/src/` → only db.ts.   |

### Project Structure Notes

After this story, `server/src/` will be:

```
server/src/
├── server.ts   ← edited (import + wire closeDb + stub-route update)
└── db.ts       ← NEW (repository + schema + pragmas + close helper)
```

No new directories. `server/src/routes/` and `server/src/security.ts` are Story 1.3's files. The `server/data/` directory already exists (has `.gitkeep`); `server/data/tasks.db` will be created at first server start — gitignored.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Task Persistence Layer (SQLite + Schema + Repository)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 → Architectural Requirements AR6–AR9]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns → Database / API / Code]
- [Source: _bmad-output/planning-artifacts/architecture.md#Service / Data Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping → FR Category 3 — Persistence (FR12–FR15)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern Examples]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-R1, NFR-R3, FR12–FR15]
- [Source: _bmad-output/implementation-artifacts/1-1-project-scaffold-orchestration.md#Completion Notes List]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **AC1 schema bootstrap + pragmas:** Cold start against missing DB file created `server/data/tasks.db` + WAL+SHM files. `sqlite3 .schema` confirmed `tasks` table (all four columns with constraints) + `idx_tasks_created_at` index. Pragmas verified via the db.ts-equivalent connection (`PRAGMA synchronous` is connection-scoped, not stored in the file — the CLI shows its own default NORMAL; a `better-sqlite3` client that runs the same `pragma()` calls as db.ts correctly reads back `synchronous: 2` = FULL). ✓
- **AC2 data-dir auto-create:** `rm -rf server/data` then server start → directory auto-created; no `ENOENT`. ✓
- **AC3–AC9 repository behavior:** 13 assertions in `verify-repo.mts` — all green. Highlights: empty list returns `[]` (AC3); shape `{id,text,completed,createdAt}` with `completed: false` and epoch-ms `createdAt` (AC4+AC5); `createTask` with duplicate id returns the original stored task, not the retry's text (AC6); `updateTask(id,{completed:true})` returns task with `createdAt` byte-identical to pre-update value (AC7); `updateTask` on missing id returns `null`; `deleteTask` idempotent on missing id (AC9). ✓
- **AC10 durability (NFR-R1 headline):** Seeded 3 tasks via a cleanly-closing script, started the dev server, found the tsx-spawned node child via `pgrep -f "bmad-test/server/node_modules/.bin/tsx"`, sent `SIGKILL` (not SIGTERM — to guarantee WAL+FULL survived a non-graceful shutdown), then read back via a fresh process → all tasks present with identical `createdAt` values. The HTTP surface (`curl http://localhost:4306/api/tasks`) returned all 5 tasks as camelCase JSON. ✓
- **AC11 boundary discipline:**
  - `grep -R "better-sqlite3" server/src/` → 1 match (`src/db.ts`). ✓
  - `grep -RE "created_at|snake_case" server/src/` → 1 match (`src/db.ts`). ✓
  - `grep -c created_at` on a real HTTP response body → 0 (no snake_case leaks over the wire). ✓
- **Typecheck + build:** `tsc --noEmit` exit 0; `tsc` emits `dist/db.js` + `dist/server.js` with sourcemaps. ✓

### Completion Notes List

**Persistence layer shipped.** `server/src/db.ts` is now the single owner of the SQLite connection, schema, and repository interface. `server.ts` imports from it via `./db.js` (NodeNext ESM specifier), boots schema on first load, and calls `closeDb()` in `gracefulShutdown`. The old stub `/api/tasks` route is now backed by the real `listTasks()` — an end-to-end read path exists, without any writes over HTTP yet (those land in Story 1.3).

**Key implementation decisions:**

- **In-transaction insert-then-re-read** for `createTask`. `INSERT OR IGNORE` alone gives row-level idempotency, but the caller still needs the canonical stored row — not whatever payload the retry sent. The transaction wraps both statements so the read is guaranteed to see the row the insert either created or left in place, atomically. Single-user or not, this is the correct shape; any future concurrency story inherits it for free.
- **Narrow `updateTask` signature.** Only `{ completed: boolean }` is accepted. Widening to allow `text` edits or `createdAt` changes would be easy *and* would silently break FR15. Keeping the signature narrow makes FR15 a compile-time invariant, not a runtime discipline. If a future story needs text edits, it gets its own method.
- **`PRAGMA synchronous = FULL` paired with WAL.** Architecture says WAL + fsync on commit → FULL. Better-sqlite3's WAL default is NORMAL (checkpoint-only fsync), which loses seconds of writes on OS crash. FULL adds ~1ms per commit, invisible at this traffic level, and satisfies NFR-R1's 14-day-zero-loss target. Verified with an actual `kill -9` in Task 5.
- **SPA fallback handler refactored to async/await + try/catch.** The post-Story-1.1 lint pass chained `.catch()` on `reply.sendFile(...)`, but `FastifyReply.sendFile` returns the reply object (chainable), not a Promise — this was a latent type error that made `tsc --noEmit` fail. Rewrote `setNotFoundHandler` as `async` and wrapped `await reply.type().sendFile(...)` in try/catch. Behavior is identical (log error, return 500 JSON if file send fails); the types are now correct.
- **Three inherited type errors fixed** as part of Task 3 because touching `server.ts` without leaving `tsc --noEmit` clean would have blocked AC11's typecheck gate. Fixes were minimal: (a) `.catch()` → async/try-catch (above), (b) `sig` parameter typed `NodeJS.Signals`, (c) `err` narrowed with `(err as Error).message` in the existing graceful-shutdown error handler. No logic changes, no defensive behavior removed.
- **No `.nvmrc` added, no `.env` machinery added.** Story 1.3's AC14 handles `--env-file` wiring for PORT + DB_PATH. For now, `db.ts` reads `process.env.DB_PATH` with a hardcoded default.
- **No tests written.** The `server/src/db.test.ts` file is Story 1.8's scope. Verification was manual — 13/13 repository assertions passed in a throwaway `verify-repo.mts` (run, reported, deleted). A `kill -9` + restart durability check is worth adding as an integration test when Story 1.8 lands; noted for that story's creation.

**Clean-up:** the test DB (`server/data/tasks.db` + WAL files) left behind from Task 5 was removed; `server/data/.gitkeep` restored so the directory stays tracked but the DB itself is gitignored.

**Enhanced DoD checklist:**

- ✅ All 6 tasks + all subtasks marked `[x]`
- ✅ All 11 ACs verified (AC1–AC9 via `tsx` scripted checks; AC10 via `kill -9` durability; AC11 via grep + HTTP response body inspection)
- ✅ No regressions: Story 1.1's Task 6 verification equivalents still pass — build clean, server boots clean, `/api/tasks` responds correctly (now backed by real DB)
- ✅ `tsc --noEmit` passes for server (fixed 3 pre-existing errors inherited from Story 1.1's post-review commit)
- ✅ `npm --prefix server run build` emits both `db.js` and `server.js` with sourcemaps
- ✅ File List complete (see below)
- ✅ Only permitted story sections modified (Status, task checkboxes, Dev Agent Record, Change Log, File List)
- ⏸ Automated tests deferred to Story 1.8 per story scope

### File List

**New files:**

- `server/src/db.ts` — SQLite connection + schema bootstrap + pragmas (WAL + FULL) + `listTasks` / `createTask` / `updateTask` / `deleteTask` / `closeDb` repository interface + exported `Task` type. ~103 LOC.

**Edited files:**

- `server/src/server.ts` — three localized changes:
  1. Added `import { closeDb, listTasks } from "./db.js";` to the import block.
  2. Stub route `GET /api/tasks` now calls `listTasks()` instead of returning literal `[]`.
  3. `gracefulShutdown(sig)` now calls `closeDb()` in an inner try/catch after `await app.close()`.
  - Additional inherited-cleanup fixes (three TypeScript errors from Story 1.1's post-review lint pass): typed the `sig` parameter, narrowed `err` via `as Error` in the outer catch, and refactored `setNotFoundHandler` to an `async` function with `try { await reply.sendFile("index.html") } catch { ... }` instead of the broken `reply.sendFile().catch()` chain.

**Generated / ignored artifacts (not committed):**

- `server/dist/db.js`, `server/dist/db.js.map` — `tsc` emit (gitignored)
- `server/data/tasks.db`, `tasks.db-shm`, `tasks.db-wal` — runtime SQLite files (gitignored; directory preserved via `.gitkeep`)

**No files removed.**

## Change Log

| Date       | Version | Description                                                                                                                            | Author             |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-24 | 0.2.0   | Story 1.2 implementation: SQLite persistence layer with schema bootstrap, WAL+FULL durability, idempotent CRUD, snake↔camel boundary. | Amelia (dev agent) |
