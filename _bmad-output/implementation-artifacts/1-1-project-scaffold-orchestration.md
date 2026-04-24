# Story 1.1: Project Scaffold & Orchestration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a working two-package project scaffold with a root orchestration script,
So that I can install dependencies, run the dev server, build, and start the app in ≤3 commands from a fresh clone.

## Acceptance Criteria

1. **Install (AC1):** Given a fresh clone, when `npm install` is run at the repo root, **then** both `client/` and `server/` dependencies install automatically (via a root `postinstall` or an explicit install script executed from the root). No manual `cd` into subfolders is required.
2. **Dev servers (AC2):** Given the installed state, when `npm run dev` is run at the root, **then** the Vite dev server starts on port **5173** and the Fastify server starts on port **3000**, both run concurrently, and orchestration uses `node:child_process` only (no `concurrently` dependency).
3. **Dev proxy (AC3):** Given the dev state is running, when a client fetches `http://localhost:5173/api/tasks`, **then** Vite's dev proxy forwards the request to `http://localhost:3000` and returns the API response. The route returns at minimum an empty JSON array `[]` with `Content-Type: application/json` (placeholder — full REST surface lands in Story 1.3).
4. **Build (AC4):** Given the installed state, when `npm run build` is run at the root, **then** Vite produces `client/dist/` with a hashed asset bundle and `index.html`, **and** `tsc` compiles server sources into `server/dist/`.
5. **Start (AC5):** Given the built state, when `npm start` is run at the root, **then** Fastify listens on port 3000 and serves both the `/api/*` surface (minimum: placeholder response per AC3) and the built static assets from `client/dist/` (with SPA-style fallback to `index.html` for unknown non-`/api/*` paths).
6. **Repo hygiene (AC6):** The repository root contains: `README.md` documenting setup in ≤3 commands; `.env.example` with `PORT=3000` and `DB_PATH=./data/tasks.db`; and `.gitignore` that excludes `node_modules`, `dist`, `data/*.db`, and `.env`.
7. **Client deps (AC7):** `client/package.json` lists exactly `react` and `react-dom` as production dependencies — nothing else. (Styling / shadcn / Tailwind / Radix arrive in Story 1.4.)
8. **Server deps (AC8):** `server/package.json` lists exactly `fastify`, `better-sqlite3`, and `@fastify/static` as production dependencies.
9. **Root deps (AC9):** Root `package.json` has **zero** production `dependencies` (orchestration scripts only; dev dependencies such as `tsx` are allowed if needed by the orchestrator).

## Tasks / Subtasks

- [x] **Task 1 — Create the two-package layout** (AC: 7, 8)
  - [x] Create the `client/` directory and initialize it with the official Vite React+TS template: `cd client && npm create vite@latest . -- --template react-ts`. Accept defaults; do **not** add styling libraries, routers, or state libraries.
  - [x] Create the `server/` directory: `cd server && npm init -y`, then install production deps `fastify better-sqlite3 @fastify/static` and dev deps `typescript tsx @types/node @types/better-sqlite3`.
  - [x] Verify after install: `client/package.json` prod deps are **exactly** `react` + `react-dom`; `server/package.json` prod deps are **exactly** `fastify` + `better-sqlite3` + `@fastify/static`. Remove anything else the Vite template added to `dependencies` (e.g., nothing should be there beyond those two). Dev deps from the Vite template (`vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `eslint*`) are fine.
- [x] **Task 2 — Configure the server package (TypeScript + minimal Fastify bootstrap)** (AC: 2, 3, 5)
  - [x] Add `server/tsconfig.json` with `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, `outDir: "./dist"`, `rootDir: "./src"`, `esModuleInterop: true`, `skipLibCheck: true`, `resolveJsonModule: true`. Use `.ts` sources under `src/`.
  - [x] Create `server/src/server.ts` that: (a) reads `PORT` from `process.env` with default `3000`; (b) boots Fastify with its built-in pino logger (`info` in prod, `debug` in dev); (c) registers a single stub route `GET /api/tasks` that responds with `[]` (status 200, `application/json`) — this is a placeholder to satisfy AC3/AC5 and will be replaced by real handlers in Story 1.3; (d) registers `@fastify/static` pointing at `../client/dist` with SPA fallback to `index.html` for any non-`/api/*` request **but only in production mode** (guard with `NODE_ENV === 'production'` or equivalent) so dev doesn't fight the Vite dev server; (e) listens on `PORT` with host `0.0.0.0`.
  - [x] **Critical registration order:** the `GET /api/tasks` stub route (and any future `/api/*` handlers) must register **before** `@fastify/static`'s SPA catchall. Static registration last, or the API paths get shadowed. See architecture.md "Decision Impact Analysis → Cross-component dependencies."
  - [x] Add `server/package.json` scripts: `"dev": "tsx watch src/server.ts"`, `"build": "tsc"`, `"start": "node dist/server.js"`.
  - [x] Confirm `tsx` is a dev dep on the server package (already installed in Task 1); do **not** install it at the root.
- [x] **Task 3 — Configure the client package (Vite + dev proxy)** (AC: 2, 3, 4)
  - [x] Edit `client/vite.config.ts` to add `server.proxy` so `'/api'` proxies to `http://localhost:3000` with `changeOrigin: true`. Keep port `5173` (Vite default) — do not override.
  - [x] Leave the Vite template's default `client/src/` scaffolding in place for this story (`main.tsx`, `App.tsx` placeholder is fine). Subsequent stories (1.4+) rebuild the UI. **Do not** add `components/`, `hooks/`, `state/`, `api/`, or `styles/` folders yet — those arrive as the relevant stories land.
  - [x] Client package scripts from the Vite template (`dev`, `build`, `preview`) stay as-is. Do not add `test` yet — Vitest arrives in Story 1.8.
- [x] **Task 4 — Root orchestration (`package.json` + dev runner)** (AC: 1, 2, 4, 5, 9)
  - [x] Create root `package.json` with `"private": true`, **no** `dependencies` field (or an empty object), and the following scripts:
    - `"postinstall": "npm install --prefix client && npm install --prefix server"`
    - `"dev": "node scripts/dev.mjs"`
    - `"build": "npm run build --prefix client && npm run build --prefix server"`
    - `"start": "npm start --prefix server"`
    - `"test": "echo \"tests arrive in Story 1.8\" && exit 0"` (placeholder — Story 1.8 replaces it)
  - [x] Create `scripts/dev.mjs` — a small (~20 LOC) orchestrator that uses `node:child_process` to spawn `npm run dev --prefix server` and `npm run dev --prefix client` in parallel, pipes their stdout/stderr to the root terminal with short prefixes (e.g., `[server]` / `[client]`), forwards SIGINT/SIGTERM to both children, and exits with a non-zero code if either child exits non-zero. **Do not** install `concurrently` or any other orchestration dep — this is a hard rule (AR26).
  - [x] The orchestrator must be plain ESM JavaScript (`.mjs`), not TypeScript — this keeps the root package dependency-free (no `tsx` at the root).
- [x] **Task 5 — Repo hygiene files** (AC: 6)
  - [x] `README.md` at repo root documenting the ≤3-command flow: `npm install` → `npm run dev` (dev) or `npm install && npm run build && npm start` (prod). Include a short "Ports" note (5173 dev UI, 3000 API/prod) and a "Requirements" note (Node 24 LTS). Keep it tight — this is reference docs, not marketing.
  - [x] `.env.example` at repo root with exactly two lines: `PORT=3000` and `DB_PATH=./data/tasks.db`. (The server-side `.env` will live at `server/.env` and is gitignored; `.env.example` at root documents the contract.)
  - [x] Replace the empty root `.gitignore` (it already exists, currently empty) with entries: `node_modules/`, `dist/`, `data/*.db`, `.env`, and `*.log`. Do **not** gitignore `.env.example`.
  - [x] Create `server/data/.gitkeep` so the runtime SQLite directory exists on clone but `data/*.db` stays ignored.
- [x] **Task 6 — Verify the full ≤3-command flow** (AC: 1, 2, 3, 4, 5)
  - [x] From a clean working tree, run `rm -rf node_modules client/node_modules server/node_modules` and confirm `npm install` at the root installs all three levels via `postinstall`.
  - [x] Run `npm run dev`, confirm both processes start, then `curl -s http://localhost:5173/api/tasks` returns `[]` (dev proxy working). Ctrl-C cleanly terminates both children. _(Verified with alt port — see Completion Notes for port-conflict workaround.)_
  - [x] Run `npm run build`, confirm `client/dist/index.html` and `server/dist/server.js` both exist.
  - [x] Run `npm start`, confirm `curl -s http://localhost:3000/api/tasks` returns `[]` and `curl -sI http://localhost:3000/` returns the built `index.html` (status 200, `text/html`). _(Verified with alt port — see Completion Notes.)_

## Dev Notes

### Story context

This is the **foundation story** of the project. No previous stories exist; no application code is in the repo (just planning artifacts under `_bmad-output/` and an empty `.gitignore`). Everything the subsequent 15 stories depend on — the two-package layout, the dep budget, the dev/prod orchestration, the env contract — is established here. **Mistakes in this story compound across the whole project.**

### The dependency budget is a first-class constraint

The PRD's NFR-M1 caps production dependencies at **10 across client + server combined**. This story installs exactly **5** (`react`, `react-dom`, `fastify`, `better-sqlite3`, `@fastify/static`). The remaining 5 slots are spent later by Story 1.4 on the shadcn/ui stack (`tailwindcss` is typically a dev dep, but `class-variance-authority`, `clsx`, `tailwind-merge`, plus the Radix primitives `@radix-ui/react-checkbox` and `@radix-ui/react-label` + `lucide-react` land at exactly 10). **Do not** pre-install anything from the shadcn stack in this story — that is Story 1.4's scope and is explicitly gated by an AC there. [Source: epics.md §Epic 1 AR3; epics.md §Story 1.4]

**Hard rule:** do not add a production dependency that is not on the approved list. Dev dependencies are fine (the Vite template ships several). If a need arises that feels like a missing prod dep, flag it in Completion Notes rather than silently adding.

### Stack versions (locked)

[Source: architecture.md §Selected Starter + §Coherence Validation]

- **Node.js:** 24 LTS (current LTS as of April 2026; Node 20 reaches EOL 2026-04-30).
- **React:** 19.x (whatever `create-vite react-ts` installs — the template tracks current React).
- **Vite:** 6+ (template default).
- **TypeScript:** 5.x (template default for client; install latest on server).
- **Fastify:** 5.x (install `fastify@^5`).
- **better-sqlite3:** 12.x (install `better-sqlite3@^12`).
- **`@fastify/static`:** whichever version is compatible with Fastify 5 (currently `@fastify/static@^8`).
- `tsx` (server dev dep): current stable.

Do not pin exact patch versions — use caret ranges so patch security updates land automatically. Do not install alpha/beta/rc versions.

### Why hand-rolled instead of a starter

[Source: architecture.md §Starter Template Evaluation]

There is no starter that matches React + Fastify + SQLite + TypeScript without dragging in Docker, Prisma, Prometheus, or similar overhead that would blow NFR-M1 and NFR-M3 (1000 LOC ceiling). The official `create-vite react-ts` template is used verbatim for the client (it adds zero prod deps beyond `react` + `react-dom`). The server is ~40 lines of bootstrap — cheaper to write than to prune from any Fastify starter. **Do not** reach for `create-express-app`, `nest-cli`, `fastify-cli`, `fastify-typescript-starter`, or any scaffolder. Do not introduce `pnpm`, `yarn workspaces`, `turborepo`, or `nx`.

### Dev orchestration uses `node:child_process` (no `concurrently`)

[Source: architecture.md §Infrastructure & Deployment → Development mode; epics.md §Epic 1 AR26]

A common instinct is to `npm install -D concurrently` at the root. That is explicitly prohibited. The reason: `concurrently` at the root forces a root `devDependency` that provides ~zero value over a ~20-line `node:child_process` script. The architecture doc treats this as a named anti-pattern. The orchestrator (`scripts/dev.mjs`) is tiny — an example shape:

```js
// scripts/dev.mjs (reference shape — adapt as needed; keep under ~30 lines)
import { spawn } from "node:child_process";

function run(name, cmd, args) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  const prefix = `[${name}]`;
  child.stdout.on("data", (d) => process.stdout.write(`${prefix} ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`${prefix} ${d}`));
  child.on("exit", (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
  return child;
}

const server = run("server", "npm", ["run", "dev", "--prefix", "server"]);
const client = run("client", "npm", ["run", "dev", "--prefix", "client"]);

function shutdown(sig) {
  server.kill(sig);
  client.kill(sig);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
```

Keep it minimal. Do **not** add log-timestamping, colorized prefixes, or restart-on-crash — those are gold-plating at this scale.

### Dev proxy configuration

[Source: architecture.md §Infrastructure & Deployment → Development mode; epics.md §Story 1.1 AC3]

`client/vite.config.ts` must add:

```ts
// inside defineConfig({ ... })
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

This means the browser talks only to Vite (`:5173`) in dev — no CORS is ever crossed. In production the Vite dev server is absent: Fastify serves both the API and the built bundle from a single origin.

### Production single-process model

[Source: architecture.md §Infrastructure & Deployment → Production deployment model]

Production = one Node process. Fastify handles both `/api/*` (route handlers) and everything else (static from `client/dist/` with SPA fallback to `index.html`). `@fastify/static` is the dep that enables this — it is worth the last slot in the initial 5-dep budget over a hand-rolled `fs.createReadStream` + MIME table (known security footgun).

**Registration order matters.** In `server.ts`, register `/api/*` route plugins/handlers **before** `@fastify/static`. If the static catchall registers first, the `/api` paths get shadowed and return the SPA shell instead of JSON. The stub `GET /api/tasks` in this story needs to already observe this ordering so Story 1.3 inherits the correct pattern.

In **development** the Vite dev server serves the frontend; the Fastify server should therefore **skip** static registration in dev (or register it conditionally on `NODE_ENV === 'production'`). The simplest gate is a single `if` block. Do not create two separate server entry points for dev vs prod.

### Environment and config

[Source: architecture.md §Infrastructure & Deployment → Environment config; epics.md §Epic 1 AR17]

- Runtime config is two env vars: `PORT` (default `3000`) and `DB_PATH` (default `./data/tasks.db`). The DB is used starting in Story 1.2 — this story only has to make `PORT` work.
- Loading `.env`: use Node 24's native `--env-file` flag (e.g., set the `start` script, if you choose, to `node --env-file=.env dist/server.js`) — or just rely on shell-exported env vars. **Do not** install `dotenv`.
- The server reads env via `process.env.PORT` directly. Keep a one-line default: `const port = Number(process.env.PORT ?? 3000);`.

### Repo structure after this story

[Source: architecture.md §Complete Project Directory Structure]

After Task 6, the tree should look like this (showing only files created by this story — the Vite template adds a few more client-side files like `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `src/assets/`, `eslint.config.js`, `index.html`, `public/` — leave those as the template generates them for now; subsequent stories will prune `src/` and remove `public/` once shadcn lands):

```
bmad-test/
├── README.md                      ← new
├── package.json                   ← new (root orchestration; no prod deps)
├── .gitignore                     ← rewrite (was empty)
├── .env.example                   ← new
├── scripts/
│   └── dev.mjs                    ← new
├── client/                        ← npm create vite@latest . -- --template react-ts
│   ├── package.json               ← deps: react, react-dom ONLY
│   ├── vite.config.ts             ← edit to add server.proxy
│   ├── tsconfig.json              ← template default
│   ├── index.html                 ← template default
│   └── src/                       ← template default scaffolding; subsequent stories restructure
└── server/                        ← hand-rolled
    ├── package.json               ← deps: fastify, better-sqlite3, @fastify/static
    ├── tsconfig.json              ← new (see Task 2)
    ├── data/
    │   └── .gitkeep               ← new
    └── src/
        └── server.ts              ← new (Fastify bootstrap + stub /api/tasks + static w/ SPA fallback)
```

### Files explicitly NOT to create in this story

[Source: architecture.md §Files explicitly NOT present]

- No `Dockerfile`, `docker-compose.yml`.
- No `.github/workflows/` or any CI config.
- No `prisma/`, `migrations/`, `drizzle/`.
- No `tests/` or `__tests__/` directory (tests will be colocated starting Story 1.8).
- No `index.ts` barrel files anywhere.
- No `shared/` or `common/` package.
- No `client/public/` additions (use the Vite default; do not add assets, icons, or a favicon custom — template's defaults are fine).
- No `src/utils/` or `src/services/`.
- No `db.ts`, `routes/`, `security.ts` on the server yet — those are Stories 1.2 and 1.3. This story's `server.ts` is intentionally minimal.
- No `tailwind.config.*`, `postcss.config.*`, `components.json`, `src/components/ui/` — those are Story 1.4.

### Naming conventions to internalize now

[Source: architecture.md §Naming Patterns]

Even though this story is mostly files-and-scripts, any TypeScript you write (e.g., a few lines in `server.ts`) must follow the project-wide conventions:

- **Modules/functions/variables:** camelCase (`listTasks`, `currentTasks`, not `list_tasks`).
- **Types/interfaces:** PascalCase, no `I`-prefix (`Task`, never `ITask`).
- **Constants (module literals):** SCREAMING_SNAKE_CASE (`DEFAULT_PORT`).
- **React components (later stories):** PascalCase, matching filename.
- **Hooks (later stories):** camelCase, `use` prefix.
- **Files:** React components → `PascalCase.tsx`; hooks → `useThing.ts`; other TS modules → `camelCase.ts` (`server.ts`, not `Server.ts`).
- **API field names (on the wire):** camelCase (`createdAt`). DB columns stay snake_case. This doesn't apply yet but is in effect from Story 1.2.

### Security headers and auth (scope boundary)

[Source: architecture.md §Authentication & Security; epics.md §Epic 1 AR15]

Auth is explicitly out of scope for v1. Security headers (CSP, X-Content-Type-Options, Referrer-Policy) live in `server/src/security.ts` as a Fastify preHandler — that module is added in **Story 1.3**. Do not add it here, and do not install `@fastify/helmet` (architecture explicitly rejects it in favor of a hand-rolled 5–10-line preHandler).

### Testing scope for this story

[Source: architecture.md §Testing Strategy]

**No automated tests are written in this story.** The test suite (Vitest for client, `node:test` for server) is introduced in **Story 1.8**. Task 6 is a manual smoke check against the ACs (run the three commands, hit the stub endpoint with `curl`). If something doesn't smoke-check, it's a real bug in the scaffold — fix it before marking the story done; do not add test code here.

**Root `test` script is a placeholder.** Use `"test": "echo \\"tests arrive in Story 1.8\\" && exit 0"`. Do not wire `vitest` or `node --test` at the root in this story.

### Idempotency and UUID strategy (context — not implemented here)

Future stories rely on client-generated UUID v4 via `crypto.randomUUID()` as the idempotency key, with server-side `INSERT OR IGNORE` guaranteeing NFR-R3. Both browser (per Vite-bundled React 19) and Node 24 have `crypto.randomUUID()` built in — **no UUID library is ever needed**. This is informational for future stories; nothing to wire up in this one. [Source: architecture.md §Data Architecture → ID strategy]

### Things to double-check before marking done

- `npm ls --omit=dev` at the root reports **zero** prod packages at the root package.
- `npm ls --omit=dev --prefix client` reports only `react` and `react-dom`.
- `npm ls --omit=dev --prefix server` reports only `fastify`, `better-sqlite3`, `@fastify/static` (plus their transitive deps — transitives don't count toward NFR-M1, only direct).
- `grep -R "concurrently" package.json scripts/ client/package.json server/package.json` returns nothing.
- `grep -R "dotenv" server/package.json client/package.json package.json` returns nothing.
- Hitting `curl -I http://localhost:5173/api/tasks` while `npm run dev` is running shows the response coming from the Vite dev server (but with the Fastify-proxied payload).
- `curl -sI http://localhost:3000/missing-client-route` after `npm start` returns the built `index.html` (SPA fallback), status 200 — but `curl -sI http://localhost:3000/api/unknown` does **not** (it should 404, not serve HTML).

### Project Structure Notes

This story **creates** the project structure prescribed in architecture.md §603 wholesale. No structural conflicts exist (the repo is empty). The scaffold intentionally leaves the Vite template's default `client/src/` layout in place for this story — later stories (1.4 onward) will restructure `src/` to match the architecture's `components/ / hooks/ / state/ / api/ / styles/` role-based organization. Do not pre-create those folders in this story.

The empty root `.gitignore` (currently 0 bytes) is replaced wholesale; `_bmad-output/` is **not** gitignored (it's committed planning artifacts — verify recent commit `dfbbc2f` preserved them).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Project Scaffold & Orchestration]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 → Architectural Requirements AR1–AR5, AR24–AR26]
- [Source: _bmad-output/planning-artifacts/architecture.md#Selected Starter: Hybrid Scaffold (Vite + hand-rolled Fastify)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment]
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Files explicitly NOT present]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Handoff]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-M1, NFR-M4]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **Clean install cascade (AC1):** `rm -rf` all `node_modules` + lockfiles, then `npm install` at root → `postinstall` installs client (113 pkgs) and server (105 pkgs). ✓
- **Prod dep audit (AC7/AC8/AC9):** `npm ls --omit=dev --depth=0` → root: empty, client: `react@19.2.5` + `react-dom@19.2.5`, server: `@fastify/static@9.1.3` + `better-sqlite3@12.9.0` + `fastify@5.8.5`. Exactly 5/10 on NFR-M1 budget. ✓
- **Forbidden-dep audit:** `grep -R "concurrently|dotenv"` across all package.json/scripts/config → no matches. ✓
- **Build (AC4):** `npm run build` produced `client/dist/index.html` + hashed `assets/index-*.js` (193 KB / 60.67 KB gzip — well inside NFR-P5's 100 KB cap) and `server/dist/server.js` with sourcemap. ✓
- **Production start + curl checks (AC5):** Run with `NODE_ENV=production PORT=4301` (see port-conflict note below).
  - `GET /api/tasks` → `200 application/json` body `[]` ✓
  - `GET /` → `200 text/html` serving built `index.html` ✓
  - `GET /some/spa/route` → `200 text/html` returning the same `index.html` (SPA fallback) ✓
  - `GET /api/unknown` → `404 application/json` `{statusCode:404,error:"Not Found",message:"Unknown API route"}` — API paths are **not** shadowed by the SPA catchall ✓
- **Dev orchestration + SIGINT (AC2):** `PORT=4302 npm run dev` → orchestrator logged `[server]` Fastify on `:4302` and `[client]` Vite on `:5179`. `kill -INT` on the orchestrator killed the whole tree cleanly; no lingering processes or bound ports. ✓
- **Dev proxy round-trip (AC3):** With server on `:4302` and Vite on `:5179`, `curl http://localhost:5179/api/tasks` → `200 application/json` body `[]` — proxy forwards correctly. Reverted `vite.config.ts` proxy target to the spec default `http://localhost:3000` after the test. ✓

### Completion Notes List

**Scaffold brought up from zero.** The repo went from an empty tree (only planning artifacts + an empty `.gitignore`) to a fully runnable two-package scaffold: `client/` via the official Vite react-ts template, `server/` hand-rolled on Fastify 5 + better-sqlite3 12 + @fastify/static 9, with a zero-prod-dep root orchestration layer.

**Key implementation notes:**

- **Server module system is ESM.** The default `npm init -y` writes `"type": "commonjs"`; I switched `server/package.json` to `"type": "module"` for consistency with the ESM client and modern Node 24 defaults. With `module: "NodeNext"` in `tsconfig.json`, TypeScript emits ESM. This requires internal relative imports (starting Story 1.2) to use the `.js` extension in specifiers — documented here so future stories inherit the pattern.
- **Dev orchestrator hardened with process-group kill.** The initial ~20-LOC version in the story's Dev Notes reference shape passed SIGINT/SIGTERM to the direct `npm` child, but `npm` doesn't always reliably forward signals to the `vite` or `tsx` grandchildren. First test run left Vite alive after the server crashed. Fix: spawn children with `detached: true` (new process group) and kill with negative PID (`process.kill(-child.pid, sig)`), which signals the whole group atomically. Still zero dependencies, still Node-native, still ~30 LOC. Verified by `kill -INT` leaving no bound ports and no lingering `tsx watch` or `vite` processes. See `scripts/dev.mjs`.
- **Production SPA fallback via `setNotFoundHandler`.** The requirement is "serve `index.html` for any non-`/api/*` path that doesn't match a real file." `@fastify/static` without `wildcard: true` serves real files under `root/` and routes everything else to the 404 handler. Using `setNotFoundHandler` with an explicit check for `/api/` prefix (→ proper JSON 404) vs everything else (→ `sendFile('index.html')`) achieves SPA fallback without the `wildcard: true` plugin mode that can mis-serve the index for asset paths with typos. This also guarantees `GET /api/unknown` does **not** return HTML — validated in Debug Log.
- **Port-conflict workaround for verification.** The dev machine had port 3000 (a long-running `next-server`) and ports 5173–5178 (five long-running `vite --host` processes from unrelated projects `annajakubik-proto*`) already bound when I ran Task 6. These are the user's own in-progress work; I did not kill them. The scaffold's spec says Fastify binds port 3000 and Vite binds 5173. Since `PORT` is env-driven on the server side and Vite's built-in port-fallback picked `:5179`, I verified AC2/AC3/AC5 functionally on alternate ports (server on 4301/4302, Vite on 5179) — this proves the mechanical scaffold works end-to-end. For AC3 specifically, I temporarily changed the `vite.config.ts` proxy target to `http://localhost:4302` for the test, then reverted it to the spec's `http://localhost:3000`. Final `vite.config.ts` matches the story Dev Notes verbatim; the architecture spec is preserved.
- **No automated tests added** (per story scope — test suite arrives in Story 1.8). Root `test` script is the specified placeholder. Task 6 is a manual smoke check; all checks pass.
- **`tsc --noEmit`** run during development exited clean (no type errors).
- **Node version.** Architecture locks the stack to Node 24 LTS. Local default was Node 22.22, but Node 24.13.0 is installed via nvm and was used for all tasks. `engines.node` is set to `>=24` on root + server `package.json` to enforce this on collaborators' machines. A `.nvmrc` was **not** added (the user's nvm is configured project-agnostically; adding one mid-scaffold felt like scope creep — can be added in a follow-up if desired).
- **Vite template default scaffolding kept in `client/src/`** (App.tsx placeholder, assets/, etc.). Story 1.4+ restructures `client/src/` to the architecture's role-based organization (`components/`, `hooks/`, `state/`, `api/`, `styles/`). `client/public/` also intentionally left as-is — architecture's "rules of absence" forbid it long-term, but Story 1.4 is the story that prunes it.
- **Dependency budget currently at 5/10 prod deps.** Matches architecture's pre-UX baseline (react, react-dom, fastify, better-sqlite3, @fastify/static). Story 1.4 will consume the remaining 5 slots with the shadcn/ui stack (class-variance-authority, clsx, tailwind-merge, @radix-ui/react-checkbox, @radix-ui/react-label, lucide-react — 6 prod deps, which lands the total at 11 and will require revisiting Story 1.4's scope against NFR-M1 at that time).

**Enhanced DoD checklist:**

- ✅ All tasks/subtasks marked `[x]`
- ✅ All 9 ACs verified (AC1, AC4, AC6, AC7, AC8, AC9 on default ports; AC2, AC3, AC5 on alternate ports with documented workaround)
- ✅ No regressions (no prior code to regress against — this is the foundation story)
- ✅ `tsc --noEmit` passes for server; client build passes type-check via `tsc -b`
- ✅ File List complete (see below)
- ✅ Only permitted story sections modified (Status, task checkboxes, Dev Agent Record, Change Log, File List)
- ⏸ Automated tests deferred to Story 1.8 per story scope — explicitly not a gap

### File List

**New files (author: dev):**

- `package.json` — root orchestration package (no prod deps; scripts for postinstall, dev, build, start, test placeholder)
- `package-lock.json` — generated by npm install
- `.gitignore` — rewrote from empty; ignores `node_modules/`, `dist/`, `data/*.db{,-journal,-shm,-wal}`, `.env`, `*.log`, `.DS_Store`
- `.env.example` — `PORT=3000` + `DB_PATH=./data/tasks.db`
- `README.md` — ≤3-command setup docs, ports table, layout diagram
- `scripts/dev.mjs` — `node:child_process`-based dev orchestrator with process-group signal handling
- `server/package.json` — hand-rolled; deps `fastify`, `better-sqlite3`, `@fastify/static`; dev deps `typescript`, `tsx`, `@types/node`, `@types/better-sqlite3`
- `server/package-lock.json` — generated
- `server/tsconfig.json` — NodeNext/ESM emit, strict, ES2022 target, sourceMap on
- `server/src/server.ts` — Fastify bootstrap with stub `GET /api/tasks`, conditional `@fastify/static` + SPA fallback in production
- `server/data/.gitkeep` — preserves the SQLite runtime directory on clone

**New files (author: Vite template via `npm create vite`):**

- `client/package.json` — prod deps `react`, `react-dom`; dev deps per template
- `client/package-lock.json`
- `client/index.html`
- `client/tsconfig.json`, `client/tsconfig.app.json`, `client/tsconfig.node.json`
- `client/eslint.config.js`
- `client/README.md` (template default; will be replaced in Story 1.4)
- `client/public/*` (favicon, vite.svg — template defaults; architecture marks `client/public/` for removal in a later story)
- `client/src/main.tsx`, `client/src/App.tsx`, `client/src/App.css`, `client/src/index.css`, `client/src/vite-env.d.ts`, `client/src/assets/*` (all template defaults)

**Edited files:**

- `client/vite.config.ts` — added `server.proxy['/api']` pointing at `http://localhost:3000` with `changeOrigin: true`. (Temporarily changed to `:4302` during AC3 verification, then reverted — final state matches spec.)

**Generated / ignored artifacts (not committed):**

- `client/dist/` — Vite build output (gitignored)
- `server/dist/server.js`, `server/dist/server.js.map` — `tsc` build output (gitignored)
- `node_modules/`, `client/node_modules/`, `server/node_modules/` (all gitignored)

## Change Log

| Date       | Version | Description                                                                                                               | Author             |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-24 | 0.1.0   | Story 1.1 implementation: two-package scaffold, root orchestration, Fastify stub server, Vite dev proxy. Status → review. | Amelia (dev agent) |

## Review Findings

### Decision Needed

- [x] [Review][Decision] Hard-coded dev proxy target — Resolved: Add `VITE_API_URL` env var support with `.env.local` fallback for flexibility. (User choice: option 2)

### Patches

- [x] [Review][Patch] Spawn error handler missing [scripts/dev.mjs:3–11] — FIXED. Wrapped spawn in try-catch; logs error and exits cleanly if spawn fails.

- [x] [Review][Patch] Child PID guard missing [scripts/dev.mjs:24] — FIXED. Added `if (child.pid && child.pid > 0)` guard before `process.kill(-child.pid, sig)`.

- [x] [Review][Patch] Server lacks graceful SIGTERM/SIGINT handlers [server/src/server.ts:35] — FIXED. Added `gracefulShutdown()` async handler that closes the Fastify instance before exiting.

- [x] [Review][Patch] Process exit race condition and no shutdown timeout [scripts/dev.mjs:15–24] — FIXED. Implemented 10-second grace period timeout; if children don't exit, force-kill with SIGKILL.

- [x] [Review][Patch] Children not awaited on exit [scripts/dev.mjs:1–32] — FIXED. Added `.unref()` on each child after spawn to prevent parent from blocking on child exit.

- [x] [Review][Patch] PORT env var unvalidated [server/src/server.ts:6] — FIXED. Added bounds validation (0–65535) and NaN check; logs error and exits if invalid.

- [x] [Review][Patch] Index.html error handling missing in SPA fallback [server/src/server.ts:28] — FIXED. Wrapped `sendFile('index.html')` in `.catch()` handler; logs error and sends friendly 500 response if file missing.

- [x] [Review][Patch] client/dist directory not verified [server/src/server.ts:20] — FIXED. Added `existsSync(clientDist)` check on startup; logs error and exits if directory missing.

- [x] [Review][Patch] Exit code semantics unclear [scripts/dev.mjs:14] — FIXED. Added comment clarifying signal check; code flow is now self-documenting.

- [x] [Review][Patch] Unhandled promise rejection during request handling [server/src/server.ts] — FIXED. Added `process.on('unhandledRejection', ...)` handler; logs rejection details.

- [x] [Review][Decision] Hard-coded dev proxy target — Resolved: Added `VITE_API_URL` env var support with default fallback to `http://localhost:3000`.

### Deferred

- [x] [Review][Defer] Placeholder test script exits 0 without running tests [package.json] — deferred, matches spec intent for Story 1.1. Real tests arrive in Story 1.8.

- [x] [Review][Defer] `wildcard: false` configuration undocumented [server/src/server.ts:22] — deferred. The config is working as intended (prevents `@fastify/static` from serving wildcard-matching files), but the rationale is not obvious. Document in a future pass or accept as internal knowledge.

- [x] [Review][Defer] stdin isolation for orchestrator [scripts/dev.mjs:3] — deferred. Setting stdio `'ignore'` for stdin is acceptable for the orchestrator; it prevents deadlocks if a dependency tries to prompt interactively. Document if needed for future maintainers.

- [x] [Review][Defer] Placeholder `/api/tasks` endpoint documents spec, not implementation [server/src/server.ts:15] — deferred, spec-mandated for Story 1.1. Real handlers and route structure arrive in Story 1.3.
