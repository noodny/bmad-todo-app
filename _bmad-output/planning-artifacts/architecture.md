---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-04-23'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - docs/initial-prd.md
project_name: 'bmad-test'
user_name: 'Chris'
date: '2026-04-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (24 FRs across 5 categories):**

- **Task Management (FR1–FR6):** CRUD on single-field tasks (≤200 char text), active/completed toggle, deletion regardless of state, creation timestamp.
- **List Presentation (FR7–FR11):** Single list view on open; stable creation-timestamp ordering; non-color visual distinction for completed; non-instructive empty state; loading state on initial fetch.
- **Persistence (FR12–FR15):** Durability across browser + server restart; fixed creation timestamp per task.
- **Error Handling & Recovery (FR16–FR20):** Per-task (not global) error surface; input preservation on failure; user/system retry with de-duplication; surfaced connectivity loss.
- **Accessibility & Interaction (FR21–FR24):** Keyboard-full operation; accessible labels on every interactive element; live-region announcements on state change; 320–1920px responsive.

Architectural implication: the error-handling and idempotency requirements (FR16–FR20, NFR-R3) are the non-trivial engineering surface in an otherwise straightforward CRUD. They force deliberate decisions about ID generation, retry semantics, and per-row state tracking.

**Non-Functional Requirements (driving architectural decisions):**

- **Performance (NFR-P1–P5):** FMP ≤1000ms, list render ≤200ms post-API, mutation UI feedback ≤100ms (optimistic), API p95 ≤300ms, JS bundle ≤100 KB gzipped. → Eliminates heavyweight UI frameworks; mandates optimistic UI as a core pattern, not a polish item.
- **Reliability (NFR-R1–R4):** Zero data loss over 14-day test; explicit reconciliation of mid-flight writes (success | marked-failed with retry | rollback); idempotent retry; zero unhandled console errors.
- **Security (NFR-S1–S4):** XSS-safe rendering of user input; no client-exposed secrets; HTTP method correctness; no third-party scripts/trackers. → No auth surface simplifies significantly; basic web hygiene only.
- **Accessibility (NFR-A1–A4):** WCAG 2.1 AA contrast, keyboard-full journey, zero critical axe/Lighthouse violations, no color-only signals.
- **Maintainability (NFR-M1–M4):** ≤5 total production dependencies (frontend + backend combined, excluding stdlib/build/dev deps); modular separation of frontend/backend/persistence; <1000 LOC total source; ≤3 commands to run from fresh clone. → The defining constraint of this architecture. Every technology choice must be justified against this budget.

**Scale & Complexity:**

- Primary domain: full-stack web (SPA + REST API + single-host persistence)
- Complexity level: low, with disciplined minimalism as the design thesis
- Estimated architectural components: 3 (frontend SPA, backend REST API, persistence layer) — plus the tiny surface that binds them

### Technical Constraints & Dependencies

Hard constraints carried from PRD:

- **Dependency budget:** ≤5 production packages total across the stack. Every dep justifiable in writing.
- **Source budget:** <1000 lines of non-generated source.
- **Bundle budget:** ≤100 KB gzipped JS to client.
- **Setup budget:** ≤3 commands from fresh clone to running app; no manual config beyond single env/config file.
- **Single-origin deployment:** no CDN assumption, no edge caching.
- **No offline mode, no PWA, no SSR, no analytics/telemetry, no third-party scripts.**
- **No auth in v1** — but architecture "should not actively block" a future auth layer (narrow scope, not "build for imagined extension").
- **Browser matrix:** latest-2 major versions of Chrome, Firefox, Safari (desktop + iOS), Edge. No IE, no polyfills for legacy engines.

Explicit non-goals (PRD "Explicit Exclusions"): scalability NFRs, integration NFRs — both deliberately out of scope.

### Cross-Cutting Concerns Identified

- **Idempotency contract:** spans client ID generation strategy, API write semantics, server-side de-duplication. Must be consistent across create (and arguably update/delete).
- **Optimistic UI reconciliation:** per-row pending/error state tracking on the client; deterministic rollback-or-retry behavior across all three mutation types.
- **Accessibility live announcements:** aria-live strategy must cover add/complete/delete — spans list region and per-row state.
- **Error-state granularity:** per-row errors (FR17) must coexist with connectivity-level errors (FR20) without the latter subsuming the former.
- **Dependency-budget enforcement:** every downstream decision (router, state library, HTTP client, DB driver, test runner) must be evaluated against NFR-M1. Default is "use stdlib + one thin framework" unless a specific requirement forces otherwise.
- **Zero-console-error discipline:** spans unhandled promise rejections, hydration mismatches, missing key warnings, resource 404s — operational hygiene as a functional requirement.

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack TypeScript web app:**
- Frontend: React SPA bundled with Vite
- Backend: Node.js (LTS) + Fastify REST API
- Persistence: SQLite via `better-sqlite3` (single-file, embedded, zero-ops)
- Shared language: TypeScript

### Starter Options Considered

**`create-vite` (official, react-ts template)** — ⭐ Selected for frontend
Official, actively maintained, minimal. Gives Vite + React 19 + TS + HMR + ESLint basics. Nothing extraneous. Bundle-friendly (Rollup under the hood).

**`create-react-app`** — Rejected
Deprecated by the React team; no longer recommended.

**Next.js / Remix / T3 Stack** — Rejected
Bring SSR, routing, auth, ORM defaults this product does not need. Each would blow NFR-M1 (≤5 prod deps) on its own. Directly contradicts the PRD's minimalism thesis.

**`matschik/fastify-typescript-starter` / `yonathan06/fastify-typescript-starter`** — Rejected for backend
Closest community starters, but each bundles Docker / Vitest config / CI / extra tooling we'd need to strip out. Cheaper to hand-scaffold ~40 lines than to prune.

**`DriftOS/fastify-starter`** — Rejected
Production-grade but brings Prisma, Docker, Prometheus, Grafana, Auth scaffolding — an order of magnitude over budget.

**Node's built-in `node:sqlite`** — Rejected (for v1)
Still experimental as of Node 24 (April 2026); not recommended for production use. `better-sqlite3` is the proven, synchronous, single-dep path for embedded SQLite. Revisit post-stabilization.

**Monorepo tooling (Turborepo / Nx / pnpm workspaces)** — Rejected
For a <1000 LOC codebase with one frontend and one backend, workspace tooling is pure overhead. A flat two-package layout with a root `package.json` orchestrator is sufficient.

### Selected Starter: Hybrid Scaffold (Vite + hand-rolled Fastify)

**Rationale for Selection:**

No single starter matches the exact stack (React + Fastify + SQLite + TS) without dragging in dependencies that would violate NFR-M1 or NFR-M4. The cost of starting with a too-big starter and pruning is higher than the cost of scaffolding the backend by hand (~40 lines of bootstrap). Using the official `create-vite` frontend template gives us best-in-class tooling for the UI with zero compromise; the backend is small enough that a starter is not a meaningful accelerator.

This choice is itself an expression of the PRD's thesis: every dependency must be justifiable in writing. A starter that brings 15 deps so we can delete 10 of them is worse than hand-crafting from 0.

**Initialization Commands (first implementation story):**

```bash
# Repository root
mkdir client server
cd client && npm create vite@latest . -- --template react-ts
cd ../server && npm init -y && npm install fastify better-sqlite3 && npm install -D typescript tsx @types/node @types/better-sqlite3
```

Final layout:

```
bmad-test/
├── package.json          # root orchestration scripts
├── client/               # Vite + React + TS
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── server/               # Fastify + SQLite + TS
    ├── src/
    ├── package.json
    └── tsconfig.json
```

Root `package.json` exposes orchestration scripts (`dev`, `build`, `start`) so that NFR-M4 (≤3 commands fresh clone → running) holds:

```
1. npm install   (installs client + server deps via postinstall or explicit script)
2. npm run dev   (starts both in parallel)
```

**Dependency Budget Check:**

| Layer | Production deps | Count |
|---|---|---|
| Frontend | `react`, `react-dom` | 2 |
| Backend | `fastify`, `better-sqlite3` | 2 |
| **Total prod deps** | | **4 / 5** ✓ |

Dev deps (excluded from NFR-M1): `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `@types/better-sqlite3`, `tsx`.

**Architectural Decisions Provided by Starter Choice:**

**Language & Runtime:**
- TypeScript across frontend and backend (single language, single mental model)
- Node.js 24 LTS on the server (current LTS as of April 2026; Node 20 reaches EOL April 30, 2026)
- Browser runtime per PRD browser matrix (latest-2 Chrome/Firefox/Safari/Edge)

**Styling Solution:**
- Deferred to step 4. Starter does not pick one. Likely plain CSS or CSS Modules to preserve the dep budget; Tailwind is a candidate only if justifiable against NFR-M1.

**Build Tooling:**
- Vite 6+ for the frontend (Rollup-based production build, esbuild for dev transform, native ESM)
- `tsx` (dev dep) for running TS directly on the backend during development
- `tsc` for backend type-checking and optional emit; production backend execution strategy to decide in step 4

**Testing Framework:**
- Not provided by starter. To decide in step 4. Candidates: Vitest (natural Vite fit), Node's built-in `node:test` (zero dep). PRD has no CI a11y gate requirement; testing posture is "light, focused."

**Code Organization:**
- Two top-level packages: `client/` (SPA) and `server/` (API). Enforces NFR-M2 (modular separation; no cross-layer imports).
- Persistence isolated as a module inside `server/` (e.g., `server/src/db.ts`) — kept as a distinct file/module to preserve separation.

**Development Experience:**
- Vite HMR for the frontend (sub-100ms update loop)
- `tsx watch` or equivalent for the backend (auto-reload on change)
- Root `package.json` script runs both concurrently — to decide in step 4: `concurrently` as a dev dep, or a shell background-job script with zero deps.

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (block implementation):** Data model, idempotency contract, optimistic-UI state model, production static-serving strategy.

**Important (shape architecture):** Validation approach, API shape, HTTP client, styling approach, testing frameworks.

**Deferred (post-MVP, per PRD "Explicit Exclusions"):** auth/authz, rate limiting, observability beyond request logs, CI gates, CDN/edge, multi-process/scaling, OpenAPI docs.

---

### Data Architecture

**Database:** SQLite via `better-sqlite3@12` (prod dep — counted in step 3).
- Single file on disk; zero external services; satisfies NFR-R1 durability.
- Synchronous API is a feature here — simpler code, no connection pooling, fits the LOC budget.

**Schema:** single `tasks` table.
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,         -- client-generated UUID v4
  text       TEXT NOT NULL CHECK (length(text) <= 200),
  completed  INTEGER NOT NULL DEFAULT 0,  -- 0|1 (SQLite has no bool)
  created_at INTEGER NOT NULL            -- Unix epoch ms, set server-side at first insert
);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
```

**Migration strategy:** none. Schema is applied idempotently at server startup (`CREATE TABLE IF NOT EXISTS`). Product is frozen post-MVP per PRD — no migration tooling justified. If schema ever changes, add a tiny sequential-step migration file; avoid adopting a framework preemptively.

**Validation:** Fastify's built-in JSON Schema validation (ajv, shipped with Fastify core — not an additional dep). Task-text length, id format (UUID), and type constraints enforced at the Fastify route level. Schemas live alongside route handlers.

**Caching:** none. Single user + in-process SQLite + SPA state. Caching would be measurement theatre at this scale.

**ID strategy (idempotency key):** client generates UUID v4 via `crypto.randomUUID()` (built-in to both browser and Node 24 — zero dep). The UUID is the idempotency key: `INSERT OR IGNORE` on the server guarantees NFR-R3 (retry produces at most one persisted task).

---

### Authentication & Security

**Auth:** none in v1 (explicit PRD exclusion). Architecture intentionally leaves a future-auth seam: all handlers live behind a single `api/` route prefix, so a future `authenticate` preHandler can be attached globally without rewriting handlers. No pre-built hooks for imagined auth — just "don't actively block."

**CORS:** none required. Same-origin deployment in production (Fastify serves the Vite bundle). In development, Vite dev server proxies `/api/*` to Fastify (standard `server.proxy` config) — no CORS across origins.

**XSS (NFR-S1):** React's default auto-escape handles user-supplied task text. Hard rule: no `dangerouslySetInnerHTML` anywhere. Server stores text verbatim; client renders as text node.

**Security headers:** minimal, hand-set in a tiny Fastify preHandler (5–10 lines): `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. Avoids `@fastify/helmet` dep; the full helmet surface is overkill for this product.

**HTTPS:** out of scope at the app layer. Production is assumed behind a reverse proxy or platform that terminates TLS. PRD does not require app-level TLS.

**Secrets (NFR-S2):** only config value at runtime is `PORT` and `DB_PATH`, both via env vars with sensible defaults. No client-exposed secrets (none exist to expose).

---

### API & Communication Patterns

**Style:** REST over JSON. Single `api/` prefix. No versioning segment (`/v1`) — product is frozen; a future breaking change justifies a fresh `/v2/` path at that time, not preemptive versioning now.

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/tasks` | List tasks, ordered by `created_at ASC` (stable, FR9) |
| `POST` | `/api/tasks` | Create task. Body: `{ id: UUID, text: string ≤200 }`. Idempotent via `INSERT OR IGNORE`. Returns the stored task. |
| `PATCH` | `/api/tasks/:id` | Toggle/set completion. Body: `{ completed: boolean }`. |
| `DELETE` | `/api/tasks/:id` | Delete. Idempotent (DELETE of missing id returns 204, not 404). |

**Error format:** Fastify default (`{ statusCode, error, message }`). Don't customise — the default is already good. Unknown-route → 404; schema-failed → 400; SQLite error → 500 with logged details but no internals leaked to the client (NFR-S2).

**Content type:** `application/json` only. Reject other content types at the Fastify layer via schema.

**Rate limiting:** none (single user).

**API docs:** not required (PRD). Endpoints documented inline in the architecture doc and in route handler comments — not via generated OpenAPI, which would cost a dep without meaningful benefit for a 4-endpoint surface.

**HTTP method correctness (NFR-S3):** enforced by Fastify's route registration — each route handler is bound to exactly one method. No dispatch-on-method anti-patterns.

---

### Frontend Architecture

**State management:** React built-ins only — `useReducer` for the task list + per-row pending/error status, `useState` for input draft. No Redux, Zustand, Jotai, or Context library.

**HTTP / data-fetching:** native `fetch`, no client library. Trade-off noted: TanStack Query would simplify the optimistic-UI + rollback + dedup pattern, but at ~13KB gzipped and +1 prod dep (would push us to 5/5 at cap). For a 4-endpoint surface, a ~100-LOC custom `useTasks()` hook built on `useReducer` is within budget and inside the LOC ceiling. Dep budget preserved for `@fastify/static` (see Infrastructure).

**Optimistic UI state model:** the reducer tracks each task with a `status: 'synced' | 'pending' | 'failed'` field (client-only, not persisted).
- Create: dispatch `OPTIMISTIC_ADD` (status=pending) → fire POST → on success dispatch `SYNC_OK`; on failure dispatch `SYNC_FAIL` (status=failed, visible inline retry affordance).
- Toggle/delete: same pattern with rollback on failure.
- Retry: user action dispatches the same optimistic action again; UUID-based idempotency on the server guarantees no duplicate (NFR-R3). `INSERT OR IGNORE` handles the create case; `PATCH`/`DELETE` are naturally idempotent by id.
- Connectivity loss (FR20): detected by fetch failure *without* a server response; surfaces a global "offline" banner separate from per-row errors (preserves per-row FR17 independence).

**Routing:** none. Single-view SPA. No `react-router-dom` dep.

**Component structure (function components + hooks):**
```
<App>
├─ <TaskInput>        // controlled input + Enter-to-submit (FR1, keyboard path)
├─ <TaskList>         // <ul> with aria-live="polite" for additions/removals
│   └─ <TaskItem>     // checkbox + text + delete; per-row status indicator
└─ <ConnectivityBanner>  // conditional, for FR20
```

**Styling:** plain CSS via CSS Modules (Vite supports natively — zero additional dep). No Tailwind/styled-components/emotion. Design-token variables defined in `client/src/styles/tokens.css`; component styles colocated with components.

**Accessibility plumbing (FR21–FR23, NFR-A1–A4):**
- Semantic HTML throughout (`<ul>`, `<li>`, `<button>`, `<input type="checkbox">`, `<label>`).
- `aria-live="polite"` on the list region; state-change announcements via text content update.
- Focus management: after create, focus returns to input; after delete, focus moves to adjacent row or back to input.
- `aria-busy` on list during initial fetch; distinct per-row indicator for `status: 'failed'`.

**Bundle strategy:** Vite default production build. No manual code-splitting (single view). Expected bundle gzipped: React 19 (~45KB) + React DOM + app code (~10–15KB) ≈ **60KB gzipped**, comfortably under the 100KB NFR-P5 budget.

**Types shared between client and server:** a tiny `shared/types.ts` — Task interface only. Duplication-vs-dependency trade-off: we *could* pull in zod (+1 dep) for runtime-validated shared shapes, but the duplication is a single interface plus one Fastify JSON schema. Zod not justified.

---

### Infrastructure & Deployment

**Production deployment model:** **single Node process**. Fastify serves:
1. `/api/*` — REST handlers
2. Everything else — the built Vite bundle (`client/dist/`) as static files, with SPA-style fallback to `index.html` for unknown client-side paths.

**Trade-off called out:** static-file serving in Fastify requires either `@fastify/static` (+1 prod dep → **5/5 at cap**) or ~30 LOC of hand-rolled `node:fs.createReadStream` + MIME table + path-traversal guard.

**Decision:** use `@fastify/static`. Rationale: hand-rolled static-file serving is a known footgun (MIME types, ETag, directory traversal, caching headers). The plugin is small, actively maintained by the Fastify team, and the 5/5 dep usage is *at* the cap but not over. The last-slot dep is better spent on correctness of a security-relevant path (static serving) than on DX sugar (e.g., TanStack Query).

**Final dep budget:** 5/5 prod deps — `react`, `react-dom`, `fastify`, `better-sqlite3`, `@fastify/static`. ✓ at NFR-M1 cap.

**Development mode:** two processes.
- Vite dev server for the frontend (HMR on port 5173)
- Fastify server for the API (port 3000)
- Vite config proxies `/api/*` → `http://localhost:3000`
- Root `package.json` runs both with a tiny `node` script using `child_process` (zero dev dep), avoiding `concurrently`.

**NFR-M4 setup verification (≤3 commands):**
```
1. npm install       # root postinstall triggers client + server installs
2. npm run build     # builds Vite bundle once for the server to serve (optional for dev)
3. npm run dev       # starts both client and server
```
Or in production: `npm install && npm run build && npm start` — still 3.

**Environment config:** single `.env` file in the server directory, loaded via Node 24's built-in `--env-file` flag (no `dotenv` dep). Variables: `PORT` (default 3000), `DB_PATH` (default `./data/tasks.db`).

**Logging:** Fastify's built-in pino logger (bundled with Fastify, not an additional dep). `info` level in production, `debug` in dev. No external log aggregation.

**Monitoring / observability:** none. Single user, single process, PRD explicitly excludes scalability/integration NFRs.

**CI/CD:** out of scope per PRD resource risk framing. If ever added, a single `npm test && npm run build` GitHub Action suffices — no part of the architecture hinges on it.

---

### Testing Strategy

**Backend:** Node's built-in `node:test` runner + `node:assert` (zero deps). Covers persistence behaviour (INSERT OR IGNORE idempotency), schema validation edges, and 4 route smoke tests. Kept light per PRD posture.

**Frontend:** Vitest (dev dep; shares Vite's transform pipeline) + React Testing Library (dev dep). Covers optimistic-UI reducer transitions (pure unit tests on the reducer function) and a small set of component smoke tests. No E2E in v1 (PRD has no CI a11y gate).

**Accessibility check (NFR-A3):** run Lighthouse or `axe-core` locally against the built app as a manual pre-ship check. Not a CI gate. Zero production-dep impact.

---

### Decision Impact Analysis

**Implementation sequence (recommended story order):**

1. **Scaffold** — run the init commands from step 3; create root package.json with orchestration scripts.
2. **Schema + DB module** (`server/src/db.ts`) — open SQLite, apply schema, export typed `tasks` repository (`list`, `create`, `update`, `remove`).
3. **Fastify server** with 4 routes + JSON-schema validation + security headers preHandler + static serving (`@fastify/static` + SPA fallback).
4. **Shared `Task` type** + API-client module on the frontend (thin fetch wrappers).
5. **`useTasks()` hook** — reducer + per-row status + optimistic create/toggle/delete with rollback.
6. **Components** — `App`, `TaskInput`, `TaskList`, `TaskItem`, `ConnectivityBanner`.
7. **CSS tokens + component styles + responsive breakpoint**.
8. **Accessibility pass** — aria-live, focus management, keyboard paths.
9. **Tests** — reducer unit tests, db tests, route smoke tests.
10. **Production build + local smoke** — `npm run build && npm start`, verify NFR-P targets + bundle size.

**Cross-component dependencies:**

- **Idempotency contract** couples the client (UUID generation), the API (request shape), and the DB (`INSERT OR IGNORE`). Any change to ID strategy must propagate across all three.
- **Per-row optimistic state** on the client is independent of the server API — the server only knows `synced` truth. The `status` field is client-only.
- **Connectivity banner (FR20) must not subsume per-row errors (FR17)**: the reducer must distinguish "transport failure" (global banner) from "server rejected this row" (per-row badge). Documented as an explicit invariant.
- **Static-file fallback order** (Fastify route registration): `api/*` handlers must register before `@fastify/static`'s catchall, or API paths will be shadowed by the SPA fallback.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 8 areas where AI agents (or the same agent across sessions) could make different choices that produce incompatible code — naming (DB/API/code), file organization, JSON shape, date format, boolean representation, reducer action style, error surfacing, loading-state semantics.

The minimalism thesis amplifies the cost of inconsistency: in a <1000 LOC codebase, an agent that introduces `snake_case` API fields in one module while everything else is `camelCase` creates a papercut that stays visible forever. These rules are narrow and enforceable.

---

### Naming Patterns

**Database (SQLite):**
- Tables: **plural, lowercase, snake_case** — `tasks` (not `Tasks`, `task`, `Task`).
- Columns: **snake_case** — `id`, `text`, `completed`, `created_at`.
- Indexes: `idx_<table>_<column>` — `idx_tasks_created_at`.
- Never use camelCase or PascalCase inside SQL. Conversion to camelCase happens exactly once, at the DB module boundary (`server/src/db.ts`).

**API / JSON on the wire:**
- Field names: **camelCase** — `createdAt`, not `created_at` (matches TypeScript conventions on both sides of the wire, no transform needed in the frontend).
- URL paths: **lowercase, plural noun, kebab-case** — `/api/tasks`, `/api/tasks/:id`. No verbs in paths. No trailing slashes.
- Route parameters: `:id` syntax (Fastify native).
- Query parameters (if any added later): camelCase, same as body fields.

**Boundary mapping rule:** the DB repository (`server/src/db.ts`) is the **only** place snake_case ↔ camelCase conversion happens. Route handlers receive and return pure camelCase objects. Never plumb snake_case beyond `db.ts`.

**Code (TypeScript, shared):**
- **Components:** PascalCase — `TaskItem`, `TaskInput`, `ConnectivityBanner`.
- **Hooks:** camelCase, `use` prefix — `useTasks`, `useConnectivity`.
- **Functions & variables:** camelCase — `fetchTasks`, `createTask`, `currentTasks`.
- **Types & interfaces:** PascalCase — `Task`, `TaskStatus`, `TasksAction`. No `I`-prefix (`ITask` is forbidden).
- **Type aliases for unions:** PascalCase — `type TaskStatus = 'synced' | 'pending' | 'failed'`.
- **Constants (module-level literals):** SCREAMING_SNAKE_CASE — `MAX_TEXT_LENGTH`, `API_BASE`.
- **Reducer action types:** SCREAMING_SNAKE_CASE string literals — `'OPTIMISTIC_ADD'`, `'SYNC_OK'`, `'SYNC_FAIL'`. Clarity at dispatch sites trumps brevity.

**Files:**
- **React components:** PascalCase matching the exported component — `TaskItem.tsx`, `TaskList.tsx`.
- **Hooks:** camelCase matching the export — `useTasks.ts`, `useConnectivity.ts`.
- **Other modules:** camelCase — `tasksReducer.ts`, `apiClient.ts`, `db.ts`, `server.ts`.
- **Style files:** CSS Modules colocated with component — `TaskItem.module.css`.
- **Test files:** `.test.ts` / `.test.tsx` suffix, colocated next to source — `tasksReducer.test.ts`, `TaskItem.test.tsx`.
- **No `index.ts` barrel files** — they hide imports, inflate bundle in some cases, and aren't justified in a small codebase.

---

### Structure Patterns

**Project organization (two-package flat layout):**
```
bmad-test/
├── package.json              # root orchestration only
├── README.md
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx          # React entry
│       ├── App.tsx
│       ├── components/       # TaskInput, TaskList, TaskItem, ConnectivityBanner
│       ├── hooks/            # useTasks, useConnectivity
│       ├── state/            # tasksReducer, action types
│       ├── api/              # apiClient (fetch wrappers), shared types
│       └── styles/
│           └── tokens.css    # design tokens (colors, spacing, fonts)
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── .env                  # PORT, DB_PATH
    └── src/
        ├── server.ts         # Fastify bootstrap + route registration
        ├── routes/
        │   └── tasks.ts      # 4 route handlers + JSON schemas
        ├── db.ts             # SQLite connection + repository functions
        └── security.ts       # tiny preHandler for security headers
```

**Test location:** colocated `*.test.ts` next to source, never a separate `tests/` or `__tests__/` directory. Agents should not move tests.

**Component organization:** by **type** (all components in `components/`, all hooks in `hooks/`) rather than by feature. Justified by scale — this is a single-feature app; feature folders would be over-organization.

**Where utilities go:** for non-component, non-hook helpers, place them adjacent to their single consumer. Do not create a shared `utils/` folder until a function has ≥2 consumers. Premature `utils/` is a smell in a <1000 LOC codebase.

**Shared types:** Task-shape types live in `client/src/api/types.ts` and are **duplicated** (not imported) on the server in `server/src/routes/tasks.ts`. No build-time import across packages. The duplication is ~10 lines; cross-package imports would require workspace tooling which step 3 rejected.

---

### Format Patterns

**API response shape:**
- **Direct response, no envelope.** `GET /api/tasks` returns `Task[]` directly. `POST /api/tasks` returns the created `Task`. No `{ data: ..., meta: ... }` wrapper.
- Rationale: a wrapper adds no value for a single-user app with no pagination or metadata. `fetch(...).then(r => r.json())` yields the data directly.

**Error response shape:**
- Fastify default — `{ statusCode: number, error: string, message: string }`. Do not customize.
- HTTP status codes semantically: `400` validation, `404` missing resource (PATCH only — DELETE is idempotent and returns 204), `500` server error.

**Date format:**
- **Epoch milliseconds (integer) everywhere** — DB column `created_at`, API `createdAt` field, client-side state. No ISO 8601 strings on the wire.
- Rationale: zero conversion layers. `new Date(task.createdAt)` works directly in the browser. Avoids timezone ambiguity entirely.
- Human display formatting happens only in the render path (e.g., `new Date(task.createdAt).toLocaleString()`), never in transit.

**Boolean format:**
- On the wire (JSON): native `true` / `false`.
- In SQLite: `INTEGER` column, values `0` / `1`. Conversion at DB module only (`Boolean(row.completed)` on read, `task.completed ? 1 : 0` on write).
- In TS: native `boolean`.

**Null vs undefined:**
- API responses: `null` for absent optional fields (JSON has no `undefined`).
- TypeScript internal: prefer `undefined`; convert to `null` only at the JSON serialization boundary.
- Task shape currently has no nullable fields; this rule is for future-proofing.

**JSON field naming (already covered):** camelCase throughout.

---

### Communication Patterns

**Reducer action shape (discriminated union, required):**
```ts
type TasksAction =
  | { type: 'INITIAL_LOAD_OK'; tasks: Task[] }
  | { type: 'INITIAL_LOAD_FAIL'; message: string }
  | { type: 'OPTIMISTIC_ADD'; task: Task }        // status: 'pending'
  | { type: 'OPTIMISTIC_TOGGLE'; id: string; completed: boolean }
  | { type: 'OPTIMISTIC_DELETE'; id: string }
  | { type: 'SYNC_OK'; id: string; task?: Task }   // clears 'pending' → 'synced'
  | { type: 'SYNC_FAIL'; id: string; message: string } // status: 'failed'
  | { type: 'RETRY'; id: string }                  // re-enter 'pending'
  | { type: 'CONNECTIVITY_CHANGED'; online: boolean };
```

**State update rule:** **always immutable**. Use spread or `.map` / `.filter`. Never mutate `state.tasks` in place. Agents writing a mutating reducer should be treated as introducing a bug.

**Action naming:**
- `OPTIMISTIC_*` — user-intent actions dispatched immediately, before server response.
- `SYNC_OK` / `SYNC_FAIL` — reconciliation actions dispatched after the server settles the fetch.
- `INITIAL_LOAD_*` — one-time startup actions.
- `RETRY` — user-initiated retry of a failed row.
- `CONNECTIVITY_CHANGED` — global banner state, orthogonal to per-row status.

**Side-effect location:** side effects (`fetch` calls) live in the `useTasks` hook or in explicit action creators, **never inside the reducer**. The reducer is pure.

**Event system:** this product has no pub/sub or event bus — the reducer is the only message channel. No custom events.

---

### Process Patterns

**Error-handling hierarchy (must be observed):**
1. **Validation failures** (client-side: invalid input) — prevented at the UI layer (input maxLength=200, disable submit on empty). Never reach the server.
2. **Schema failures** (server: 400) — logged at `warn`, returned with Fastify's default body. Client shows per-row `SYNC_FAIL`.
3. **Persistence failures** (server: 500) — logged at `error` with full stack; client sees sanitized `{ statusCode, error, message }`; client shows per-row `SYNC_FAIL`.
4. **Network failures** (no server response) — distinguished by `fetch` rejection (vs response with error status). Client dispatches `CONNECTIVITY_CHANGED` + `SYNC_FAIL` for the specific row. Global banner appears.
5. **Uncaught exceptions** — the React top-level `ErrorBoundary` catches render-time errors. Node `process.on('uncaughtException')` logs and exits (let the process manager restart). **No silent catches anywhere** (NFR-R4 + zero-console-error discipline).

**Loading-state semantics:**
- **Single boolean `isLoading`** in reducer state — `true` only during initial list fetch. Flips to `false` after `INITIAL_LOAD_OK` or `INITIAL_LOAD_FAIL`. Never re-set to `true` after that.
- **No global "busy" flag** for mutations — optimistic UI makes mutations appear instantaneous; there is nothing to show a spinner for.
- **Per-row status** (`'pending'`, `'synced'`, `'failed'`) is the sole vehicle for mutation state. Rendered as small inline affordances (subtle dot or spinner on `pending`, error badge + retry button on `failed`).

**Retry pattern:**
- User-initiated retry is the default (keep the control explicit — matches PRD journey 2).
- No automatic retry loop in v1 (avoid surprise behavior; keep LOC budget).
- Retry re-dispatches the same `OPTIMISTIC_*` action using the **same UUID**; server idempotency (`INSERT OR IGNORE`, DELETE-if-exists, idempotent PATCH) guarantees single effect.

**Logging format (server):**
- Fastify's pino default — one JSON object per line.
- Levels: `error` (thrown errors, 5xx), `warn` (4xx responses), `info` (request completion, default), `debug` (dev only).
- Never log task text (user content) at `info` — keep it to `debug` for privacy hygiene (even in a single-user app, this sets the right example).

---

### Enforcement Guidelines

**All AI Agents MUST:**

- Convert snake_case ↔ camelCase **only** in `server/src/db.ts`. API route handlers and client code see only camelCase.
- Treat UUIDs as opaque strings. Generate via `crypto.randomUUID()` exclusively. Never derive IDs from text, timestamps, or counters.
- Keep the reducer pure. All `fetch` calls live in hooks or action-dispatching helpers.
- Use CSS Modules for component styles. Never introduce `styled-components`, `emotion`, `tailwindcss`, or inline style props for anything beyond one-off dynamic values.
- Introduce a new production dependency only by **first proposing the trade-off against the NFR-M1 5-dep cap in a PR description**. Dev dependencies require no such check.
- Colocate tests and styles next to source. Never introduce top-level `tests/` or `styles/` directories.
- Preserve the 5/5 prod dep list verbatim: `react`, `react-dom`, `fastify`, `better-sqlite3`, `@fastify/static`. Any change updates the architecture doc.

**Pattern Enforcement:**

- **Verification:** a tiny pre-commit check (or CI check, if added) can grep for `snake_case` field names in route handlers, `styled-components` imports, and `package.json` additions — low-tech but sufficient for this project's scale.
- **Documenting violations:** if a rule must be broken, the breaking PR updates this patterns section with the new rule and the reasoning. No silent drift.
- **Updating patterns:** patterns change by explicit edit to this document, not by precedent. If an agent introduces a new convention without doc update, it's a bug to be reverted.

---

### Pattern Examples

**Good:**

```ts
// server/src/db.ts — the ONE place snake_case lives
type TaskRow = { id: string; text: string; completed: number; created_at: number };
export function listTasks(): Task[] {
  const rows = db.prepare('SELECT id, text, completed, created_at FROM tasks ORDER BY created_at ASC').all() as TaskRow[];
  return rows.map(r => ({ id: r.id, text: r.text, completed: Boolean(r.completed), createdAt: r.created_at }));
}

// client/src/state/tasksReducer.ts — pure, immutable
case 'OPTIMISTIC_ADD':
  return { ...state, tasks: [...state.tasks, { ...action.task, status: 'pending' }] };
```

**Anti-patterns (forbidden):**

```ts
// ❌ snake_case leaking to API handler
reply.send({ created_at: row.created_at });

// ❌ mutating reducer state
state.tasks.push(newTask);
return state;

// ❌ silent catch
try { await fetch(...); } catch { /* ignore */ }

// ❌ side effect in reducer
case 'OPTIMISTIC_ADD':
  fetch('/api/tasks', { method: 'POST', body: JSON.stringify(action.task) });  // WRONG PLACE
  return { ...state, tasks: [...state.tasks, action.task] };

// ❌ introducing a dep without doc update
// "Added zod because it made validation nicer" — rejected; validation already uses Fastify's built-in ajv.
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
bmad-test/
├── README.md                              # setup + run instructions (≤3 commands)
├── package.json                           # root orchestration scripts (dev, build, start, test)
├── .gitignore                             # node_modules, dist, data/*.db, .env
├── .env.example                           # PORT=3000, DB_PATH=./data/tasks.db
│
├── _bmad-output/                          # (existing, not part of app)
│   └── planning-artifacts/
│       ├── prd.md
│       ├── ux-design-specification.md
│       └── architecture.md                # ← this document
│
├── client/                                # ── FRONTEND PACKAGE ──
│   ├── package.json                       # deps: react, react-dom
│   ├── tsconfig.json                      # strict: true
│   ├── tsconfig.node.json                 # for vite.config.ts
│   ├── vite.config.ts                     # React plugin + /api proxy to :3000
│   ├── index.html                         # single document, #root mount point
│   └── src/
│       ├── main.tsx                       # createRoot + <App/>
│       ├── App.tsx                        # composes TaskInput + TaskList + ConnectivityBanner
│       ├── App.module.css
│       ├── components/
│       │   ├── TaskInput.tsx              # FR1, FR21: Enter-to-submit input
│       │   ├── TaskInput.module.css
│       │   ├── TaskList.tsx               # FR7, FR9, FR10, FR11: list + empty + loading + aria-live
│       │   ├── TaskList.module.css
│       │   ├── TaskItem.tsx               # FR2, FR3, FR4, FR8, FR17: row + toggle + delete + per-row status
│       │   ├── TaskItem.module.css
│       │   ├── ConnectivityBanner.tsx     # FR20: global offline indicator
│       │   └── ConnectivityBanner.module.css
│       ├── hooks/
│       │   ├── useTasks.ts                # wires reducer to api calls; optimistic + reconciliation
│       │   ├── useTasks.test.ts
│       │   └── useConnectivity.ts         # window online/offline listeners → reducer
│       ├── state/
│       │   ├── tasksReducer.ts            # pure reducer; all state transitions
│       │   └── tasksReducer.test.ts       # covers every action + per-row transitions
│       ├── api/
│       │   ├── types.ts                   # Task, TaskStatus, Tasks state shape
│       │   └── apiClient.ts               # fetch wrappers: listTasks, createTask, toggleTask, deleteTask
│       └── styles/
│           ├── tokens.css                 # design tokens: colors (WCAG AA), spacing, typography
│           └── reset.css                  # minimal global reset
│
└── server/                                # ── BACKEND PACKAGE ──
    ├── package.json                       # deps: fastify, better-sqlite3, @fastify/static
    ├── tsconfig.json                      # strict: true; NodeNext module
    ├── .env                               # gitignored; generated from .env.example
    ├── data/                              # gitignored; SQLite file lives here at runtime
    │   └── .gitkeep
    └── src/
        ├── server.ts                      # Fastify bootstrap, plugin registration, listen
        ├── db.ts                          # SQLite open + schema + repository (listTasks, createTask, updateTask, deleteTask)
        ├── db.test.ts                     # idempotency (INSERT OR IGNORE), ordering, updates
        ├── security.ts                    # preHandler: CSP, X-Content-Type-Options, Referrer-Policy
        └── routes/
            ├── tasks.ts                   # 4 handlers + JSON schemas (ajv-validated)
            └── tasks.test.ts              # 4 route smoke tests
```

**Files explicitly NOT present** (rules-of-absence to prevent drift):

- No `src/utils/` (no shared util with ≥2 consumers yet)
- No `src/services/` (the repository in `db.ts` is already the service layer)
- No top-level `tests/` or `__tests__/` directory (tests are colocated)
- No `index.ts` barrel files anywhere
- No `Dockerfile` or `docker-compose.yml` (out of scope; reverse proxy or platform handles deployment)
- No `.github/workflows/` (PRD has no CI requirement; add only when explicitly needed)
- No `prisma/`, `migrations/`, `drizzle/` (no ORM; no migration framework)
- No `public/` directory in `client/` (Vite serves static assets from `src/` imports; no public folder needed for this app)
- No `shared/` or `common/` package (types are duplicated by design)

---

### Architectural Boundaries

**API Boundaries (external):**
- Client ⇄ Server: HTTP over JSON, under `/api/*`. 4 endpoints total (see step 4).
- Browser ⇄ Server: static asset serving (SPA bundle + `index.html`) for everything else.
- Everything else is forbidden — no WebSocket, no Server-Sent Events, no GraphQL, no gRPC.

**Component Boundaries (frontend):**
- **`<App>`** owns the top-level composition but no state — state lives in `useTasks`.
- **`<TaskInput>`** — controlled input, emits `onSubmit(text)` upward. Never touches the reducer directly.
- **`<TaskList>`** — receives `tasks`, `onToggle`, `onDelete`, `onRetry` as props. Pure presentational + `aria-live`.
- **`<TaskItem>`** — receives a single `Task` + callbacks. Renders status indicator based on `task.status`.
- **`<ConnectivityBanner>`** — subscribes to online status via `useConnectivity`, renders conditionally.
- **Rule:** no sibling component imports another sibling. Composition flows top-down through `<App>`.

**Service / Data Boundaries (backend):**
- **`server.ts`** knows Fastify and `.env`; imports `db.ts` and route plugins; does not execute SQL directly.
- **`routes/tasks.ts`** knows the HTTP surface and JSON schemas; imports the `db` repository; does not construct SQL.
- **`db.ts`** knows SQLite and the schema; exports the repository interface; is the **only** file that imports `better-sqlite3`.
- **Import direction is strictly one-way:** `server.ts → routes/ → db.ts`. `db.ts` never imports anything from `routes/` or `server.ts`.

**Data Boundaries (persistence):**
- The SQLite file (`data/tasks.db`) is owned exclusively by the server process. No external tool writes to it during normal operation.
- Schema is created at server startup via `CREATE TABLE IF NOT EXISTS`; no separate migration tool.
- Backup is out of scope (personal, single-user; user can copy the file).

---

### Requirements to Structure Mapping

**FR Category 1 — Task Management (FR1–FR6):**
- Client: `components/TaskInput.tsx` (create), `components/TaskItem.tsx` (toggle + delete), `state/tasksReducer.ts` (state transitions), `hooks/useTasks.ts` (wiring).
- Server: `routes/tasks.ts` (all 4 endpoints), `db.ts` (`createTask`, `updateTask`, `deleteTask`).
- DB: `tasks` table schema in `db.ts`.
- Tests: `tasksReducer.test.ts`, `db.test.ts`, `routes/tasks.test.ts`.

**FR Category 2 — List Presentation (FR7–FR11):**
- Client: `components/TaskList.tsx` (empty state, loading state, list rendering), `hooks/useTasks.ts` (initial fetch + `isLoading`).
- Server: `routes/tasks.ts` (GET endpoint), `db.ts` (`listTasks` with `ORDER BY created_at ASC`).
- FR8 (non-color distinction): styled in `TaskItem.module.css` using strikethrough + opacity + aria attributes.
- FR11 (loading state): tracked by reducer's `isLoading`, rendered in `TaskList.tsx`.

**FR Category 3 — Persistence (FR12–FR15):**
- Server: `db.ts` — SQLite writes to `DB_PATH`; schema sets `created_at` as immutable (set once at INSERT, never in UPDATE).
- Rules of durability (NFR-R1) are structural: SQLite's WAL mode (enabled in `db.ts` init) + fsync on commit.
- FR15 (immutable creation timestamp) enforced in `db.ts` — `updateTask` never touches `created_at`.

**FR Category 4 — Error Handling & Recovery (FR16–FR20):**
- Client: `state/tasksReducer.ts` (per-row `status` field), `components/TaskItem.tsx` (inline error + retry affordance), `components/ConnectivityBanner.tsx` (global offline indicator), `hooks/useTasks.ts` (fetch-failure detection).
- Server: `routes/tasks.ts` (Fastify default error shape; INSERT OR IGNORE for idempotency).
- FR19 (idempotent retry) is structurally enforced by UUID as primary key + `INSERT OR IGNORE`; documented in `db.ts`.
- Cross-boundary invariant: per-row errors (FR17) must not be subsumed by the connectivity banner (FR20). Enforced in reducer logic + tested in `tasksReducer.test.ts`.

**FR Category 5 — Accessibility & Interaction (FR21–FR24):**
- Client: every component uses semantic HTML; `components/TaskList.tsx` owns `aria-live`; `components/TaskInput.tsx` handles focus management; `components/TaskItem.tsx` uses `<button>` and `<input type="checkbox">` (never `<div onClick>`).
- `styles/tokens.css` defines WCAG AA contrast values (NFR-A1).
- FR24 (320–1920px responsive) handled via CSS in `App.module.css` and component styles — single media query breakpoint.
- No dedicated a11y file; accessibility lives in every component by rule.

**Cross-Cutting Concerns:**
- **Idempotency contract** — spans `client/src/api/apiClient.ts` (UUID generation), `server/src/routes/tasks.ts` (validation), `server/src/db.ts` (`INSERT OR IGNORE`). Documented in all three.
- **Security headers (NFR-S1–S4)** — `server/src/security.ts` as a Fastify preHandler, registered once in `server.ts`.
- **Logging** — Fastify's built-in pino, configured in `server.ts`. No separate logger module.
- **Bundle budget (NFR-P5)** — enforced structurally by keeping `client/package.json` deps to `react` + `react-dom`. No runtime checks needed; npm ls + bundle analyser if verification required.

---

### Integration Points

**Internal Communication:**

- **Client → Server:** HTTP fetch from `client/src/api/apiClient.ts` to `/api/*`. The only integration seam between packages.
- **Reducer → Hook:** dispatch calls inside `useTasks`; side effects (fetch) are handled in the hook after dispatch.
- **Hook → Components:** data flows down via props; user actions flow up via callback props.
- **Route → Repository:** route handler calls functions on `db.ts`; receives typed `Task` objects; never raw rows.

**External Integrations:**
- None in v1. The product is fully self-contained.
- Future-auth seam: all mutation routes are under `/api/*` with a consistent shape; a future global preHandler can add authenticate-or-reject in one place.

**Data Flow (request lifecycle for "add task"):**

```
1. User types text + presses Enter in <TaskInput>
2. <TaskInput> calls onSubmit(text) → passed in from <App> → from useTasks
3. useTasks generates UUID via crypto.randomUUID(), creates a Task object
4. useTasks dispatches OPTIMISTIC_ADD → reducer appends task with status='pending'
5. Components re-render; <TaskItem> shows subtle pending indicator
6. useTasks fires POST /api/tasks with { id, text }
7. Server: Fastify validates JSON schema → routes/tasks.ts handler → db.createTask()
8. db.ts: INSERT OR IGNORE INTO tasks (id, text, completed, created_at) VALUES (...)
   - If row exists (duplicate UUID), returns existing row (idempotency)
   - Otherwise inserts with Date.now() and returns new row
9. db.ts converts row to Task shape (camelCase, boolean) and returns
10. routes/tasks.ts reply.send(task)
11. Back in useTasks: on fetch resolve, dispatch SYNC_OK with the server's truth
12. Reducer sets status='synced'; pending indicator clears

Failure branches (any of steps 6–11):
- Network failure → SYNC_FAIL + CONNECTIVITY_CHANGED (online=false); row shows error + retry
- Server 400/500 → SYNC_FAIL; row shows error + retry; connectivity banner does NOT appear
- Retry → same UUID → step 5 again → idempotency guarantees single row
```

---

### File Organization Patterns

**Configuration Files:**
- Per-package: `package.json` and `tsconfig.json` in each of `client/` and `server/`.
- Root `package.json` contains only orchestration scripts; has no dependencies of its own.
- Environment: `server/.env` only. Frontend has no env file in v1 (base URL is same-origin).
- Build config: `client/vite.config.ts` only. Server uses raw `tsc` / `tsx`.

**Source Organization (summary rule):** by role (`components`, `hooks`, `state`, `api`, `routes`) rather than by feature. Acceptable at this scale.

**Test Organization:** colocated `*.test.ts` adjacent to source. No separate directory. Test discovery via Vitest (client) and `node --test` glob (server).

**Asset Organization:** none. No images, no fonts beyond system stack. If an icon is needed, prefer inline SVG over a separate asset file until justified.

---

### Development Workflow Integration

**Development server structure:**
- Two processes: Vite dev (port 5173, HMR) + Fastify (port 3000, `tsx watch`). Started by root `npm run dev` via a ~15-line orchestrator using `node:child_process`.
- Vite's `server.proxy` forwards `/api/*` to `http://localhost:3000`. No CORS ever hit.

**Build process structure:**
- `npm run build` at root:
  1. `cd client && npm run build` → Vite produces `client/dist/` (hashed-asset bundle + `index.html`).
  2. `cd server && npx tsc` → `server/dist/` (compiled JS).
- No shared build step between packages. Each package builds independently.

**Deployment structure:**
- Single command: `npm start` at root → runs `node server/dist/server.js`.
- Server serves `/api/*` from its route handlers and everything else from `client/dist/` via `@fastify/static`.
- Assumes the SQLite file's parent directory exists (`data/`) — server creates it on startup if missing.
- Default port 3000 (`PORT` env overrides).

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

- Stack versions (React 19.2.5, Vite 6, Fastify 5.8.5, better-sqlite3 12.9.0, Node 24.15 LTS, TypeScript 5.x) are all current, mutually compatible, and actively maintained as of April 2026.
- `@fastify/static` is maintained by the Fastify team and follows Fastify 5's plugin API — no version skew risk.
- SQLite's synchronous API (via better-sqlite3) and Fastify's async handlers coexist cleanly because SQLite calls are microsecond-scale and don't starve the event loop at this data volume.
- TypeScript strict mode on both sides; shared `Task` shape is trivially duplicated (one interface), so no type-drift risk at this scale.

**Pattern Consistency:**

- camelCase on the wire + snake_case in the DB, with conversion isolated to `db.ts`, is consistent across all 4 endpoints and the 4 repository functions.
- Optimistic UI + UUID idempotency + `INSERT OR IGNORE` + same-UUID retry form a coherent chain: each link reinforces the next. No conflicting guarantees.
- Discriminated-union actions + pure reducer + side-effects-in-hook matches React's reconciliation model and allows the reducer to be unit-tested without mocking.
- File-naming (PascalCase components, camelCase hooks/modules, colocated tests) is internally consistent.

**Structure Alignment:**

- The two-package flat layout enforces NFR-M2 (no cross-layer imports) at the file-system level: `client/` cannot import from `server/` and vice versa.
- Strict import direction `server.ts → routes/ → db.ts` makes the backend layering auditable via `grep`.
- Component composition flowing top-down through `<App>` (no sibling imports) matches React best practices and prevents accidental state coupling.

---

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (24/24 FRs):**

| FR | Coverage | Location |
|---|---|---|
| FR1 — Create task | ✅ | `TaskInput.tsx` + `POST /api/tasks` + `db.createTask` |
| FR2 — Mark complete | ✅ | `TaskItem.tsx` checkbox + `PATCH /api/tasks/:id` |
| FR3 — Mark active (toggle back) | ✅ | Same path as FR2, `completed: false` |
| FR4 — Delete task | ✅ | `TaskItem.tsx` delete button + `DELETE /api/tasks/:id` |
| FR5 — Text ≤ 200 chars | ✅ | Fastify JSON schema (server) + HTML `maxLength` (client) + SQLite `CHECK` constraint |
| FR6 — Completion status | ✅ | `tasks.completed` column |
| FR7 — View all tasks | ✅ | `GET /api/tasks` + `<TaskList>` |
| FR8 — Non-color visual distinction | ✅ | `TaskItem.module.css` strikethrough + opacity (never color-only) |
| FR9 — Stable ordering | ✅ | `ORDER BY created_at ASC` in `db.listTasks` |
| FR10 — Non-instructive empty state | ✅ | `<TaskList>` renders empty branch with no tutorial/modal |
| FR11 — Loading state | ✅ | `isLoading` in reducer + `<TaskList>` rendering |
| FR12 — Persist across browser refresh | ✅ | Server-backed SQLite |
| FR13 — Persist across server restart | ✅ | File-based SQLite + WAL mode |
| FR14 — Completion state persists | ✅ | `tasks.completed` column |
| FR15 — Immutable creation timestamp | ✅ | `db.updateTask` never touches `created_at`; enforced by repository interface |
| FR16 — Error state surfaced | ✅ | Reducer `status='failed'` + `<TaskItem>` error affordance |
| FR17 — Per-task (not global) error | ✅ | Per-row `status` field; connectivity is orthogonal (FR20) |
| FR18 — Input preserved on failure | ✅ | **Invariant**: optimistic add moves text into the list row; on failure the row persists with status='failed' — text is visible and recoverable. Input clears after dispatch; list row is the preservation medium. |
| FR19 — Idempotent retry | ✅ | UUID primary key + `INSERT OR IGNORE` + idempotent PATCH/DELETE |
| FR20 — Connectivity loss surfaced | ✅ | `<ConnectivityBanner>` + `useConnectivity` + `CONNECTIVITY_CHANGED` action |
| FR21 — Keyboard-only operation | ✅ | Semantic `<input>`/`<button>`/`<input type=checkbox>`; Enter-to-submit |
| FR22 — Accessible labels | ✅ | Every interactive element has `<label>` or `aria-label`; enforced by rule |
| FR23 — Assistive tech announcements | ✅ | `aria-live="polite"` on `<TaskList>` — **invariant**: every state change (add/toggle/delete) causes a text-content change that the live region will announce |
| FR24 — 320–1920px responsive | ✅ | Single breakpoint in `App.module.css` + component-level responsive CSS |

**Non-Functional Requirements Coverage (17/17 NFRs):**

| NFR | Target | Architectural Mechanism |
|---|---|---|
| NFR-P1 | FMP ≤ 1000 ms | Bundle ~60 KB + Vite-optimized production build + no SSR wait |
| NFR-P2 | List render ≤ 200 ms | Direct `map` over state; no virtualization needed at this scale |
| NFR-P3 | Mutation feedback ≤ 100 ms | Optimistic UI dispatches before fetch |
| NFR-P4 | API p95 ≤ 300 ms | SQLite in-process (microsecond queries) + Fastify's low overhead |
| NFR-P5 | Bundle ≤ 100 KB gzipped | Dep budget structurally prevents bloat (~60 KB expected) |
| NFR-R1 | Zero data loss 14 days | SQLite WAL + fsync on commit (enabled in `db.ts` init) |
| NFR-R2 | Three testable write outcomes | `SYNC_OK` / `SYNC_FAIL` / `RETRY` reducer actions + docs tests |
| NFR-R3 | Idempotent retry | UUID + `INSERT OR IGNORE` + idempotent PATCH/DELETE |
| NFR-R4 | Zero unhandled console errors | React `ErrorBoundary` + Node `uncaughtException` handler + no silent catches rule |
| NFR-S1 | XSS-safe rendering | React auto-escape + no `dangerouslySetInnerHTML` rule |
| NFR-S2 | No client-exposed secrets | Server-only `.env`; no secrets exist |
| NFR-S3 | HTTP method correctness | Fastify's explicit route-per-method binding |
| NFR-S4 | No third-party scripts | Dep budget enforces structurally |
| NFR-A1 | WCAG AA contrast | `tokens.css` color tokens verified against AA ratios |
| NFR-A2 | Keyboard-full journey | Semantic HTML + Enter-to-submit + focus management rule |
| NFR-A3 | Zero critical axe violations | Semantic HTML + proper labels + aria-live; manual Lighthouse check pre-ship |
| NFR-A4 | Non-color status | Strikethrough + opacity on completed; error badge + icon on failed |
| NFR-M1 | ≤ 5 prod deps | 5/5 at cap — react, react-dom, fastify, better-sqlite3, @fastify/static |
| NFR-M2 | Modular separation | Two-package layout + import-direction rules |
| NFR-M3 | < 1000 LOC | Estimated ~700-850 LOC total; structure keeps each file focused |
| NFR-M4 | ≤ 3 commands setup | `npm install && npm run build && npm start` = 3 |

**Explicit PRD exclusions honored:** no auth, no multi-user, no priorities/tags/deadlines, no search, no sharing, no undo, no AI input, no offline mode, no PWA, no analytics, no CDN, no scalability NFRs, no integration NFRs. Architecture carries zero scaffolding for any of these.

---

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions (data model, ID strategy, optimistic state model, static serving) documented with rationale.
- Every production dependency listed with its version constraint line and justification.
- No deferred-to-later decisions in the critical path.

**Structure Completeness:**
- Every expected file is named and described.
- "Files not present" list prevents agents from creating spurious scaffolding (`utils/`, `services/`, `Dockerfile`, barrel `index.ts`, etc.).
- Import direction rule is explicit and grep-verifiable.

**Pattern Completeness:**
- Eight conflict categories addressed (naming across DB/API/code, file organization, JSON shape, date format, boolean representation, reducer action style, error hierarchy, loading semantics).
- Good / anti-pattern examples provided for the four most footgun-prone areas.
- Enforcement guidelines specify which rules are mandatory and how violations are detected.

---

### Gap Analysis Results

**Critical Gaps:** none. The architecture is implementable end-to-end from this document alone.

**Important Gaps (addressed inline in validation tables above):**

1. **FR18 preservation medium** — added invariant clarification: the list row (not the input) is the preservation medium after an optimistic add failure.
2. **FR23 announcement invariant** — added invariant: every state change must cause a text-content change inside the `aria-live` region.

**Nice-to-Have Gaps (acceptable to defer):**

- **Accessibility announcement wording** — not prescribed (e.g., "Task added" vs "New task: buy bread"). Any reasonable text that conveys the state change satisfies FR23. Leaving this to implementation judgment.
- **Visual design tokens** — exact color hex values not specified in this doc. `tokens.css` will contain them; any palette meeting WCAG AA contrast is acceptable.
- **README content** — not part of architecture; story 1 will produce it.
- **Exact orchestrator script** — the ~15 LOC node:child_process script to run dev servers in parallel is sketched but not written out; acceptable for implementation to finalize.

---

### Validation Issues Addressed

- **SQLite concurrent-write risk:** single-user single-process application — no concurrency concern. WAL mode handles the rare case of a backup tool reading while writes occur.
- **Bundle bloat risk:** structurally prevented by the 5-dep cap and the "no new deps without doc update" rule. Verified expected bundle (~60 KB) is well under the 100 KB ceiling.
- **Per-row error vs connectivity banner collision (FR17 × FR20):** explicit invariant in patterns + test coverage in `tasksReducer.test.ts` for the distinction between `SYNC_FAIL` (per-row) and `CONNECTIVITY_CHANGED` (global).
- **Static-serving route shadowing:** documented that API routes must register before `@fastify/static` catchall; this is both a pattern rule and a test target.
- **Migration path risk:** none — schema is frozen by the PRD's "done is a design goal" thesis. If the schema ever needs to change, the one-table surface is trivial to migrate manually.

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (24 FRs, 17 NFRs, PRD thesis)
- [x] Scale and complexity assessed (low complexity, hard minimalism)
- [x] Technical constraints identified (5-dep / 1000-LOC / 100-KB / 3-command budgets)
- [x] Cross-cutting concerns mapped (6 concerns)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions (React 19.2.5, Fastify 5.8.5, better-sqlite3 12.9.0, Node 24.15 LTS, TypeScript 5.x, Vite 6.x, @fastify/static latest-5-compatible)
- [x] Technology stack fully specified
- [x] Integration patterns defined (HTTP + JSON + 4 endpoints + idempotency contract)
- [x] Performance considerations addressed (5 NFR-P targets mapped)

**✅ Implementation Patterns**
- [x] Naming conventions established (DB/API/code/files)
- [x] Structure patterns defined (colocation, role-based folders)
- [x] Communication patterns specified (reducer actions, import direction)
- [x] Process patterns documented (5-level error hierarchy, loading semantics, retry)

**✅ Project Structure**
- [x] Complete directory structure defined (every file named)
- [x] Component boundaries established (prop-down, callback-up)
- [x] Integration points mapped (single client→server seam)
- [x] Requirements → structure mapping complete (all 24 FRs traced)

---

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH — the architecture is coherent, complete, and narrowly tailored to the PRD's minimalism thesis. Implementation risk is concentrated in three well-understood areas: (1) optimistic-UI reconciliation logic (~100 LOC in reducer + hook, directly testable), (2) WAL + fsync SQLite configuration (3 PRAGMA lines), (3) `@fastify/static` SPA fallback registration order (one-line ordering rule in `server.ts`). None of these are novel; all have documented solutions.

**Key Strengths:**

- **Budget discipline enforced structurally**, not just documented. The 5-dep cap is reflected in the file tree itself; agents cannot silently exceed it without updating this doc.
- **Single-seam client↔server boundary** (one HTTP surface, 4 endpoints) keeps the integration risk trivially auditable.
- **Per-row optimistic state model** with `pending/synced/failed` statuses solves FR16–FR20 cleanly and testably.
- **Rules-of-absence list** prevents the "agent adds Docker and Prisma because it's the default in their training data" failure mode that would destroy the product's thesis.
- **Idempotency chain** (client UUID → server INSERT OR IGNORE → same-UUID retry) is end-to-end reasoned about, not bolted on.

**Areas for Future Enhancement (post-MVP, explicitly out of scope now):**

- Migration to Node's built-in `node:sqlite` once it stabilizes (drops `better-sqlite3` dep → 4/5 budget with headroom).
- If accessibility audit becomes a requirement, adding `axe-core` to the dev-dep pipeline as a pre-commit check.
- If the product ever grows a second feature, revisiting whether `components/` stays role-organized or flips to feature-organized.

---

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented. Every deviation must update this document first.
- Use implementation patterns consistently across all components. Rule-following over cleverness.
- Respect project structure and boundaries — import direction, file locations, file-naming all enforceable via grep.
- Refer to this document for all architectural questions. When in doubt, re-read the relevant step.
- **Do not introduce any production dependency beyond the 5 listed.** Dev dependencies are fine.
- **Do not create files listed in "Files explicitly NOT present."**

**First Implementation Priority:**

Story 1 — **Scaffold the project**:

```bash
# from repository root (bmad-test/)
mkdir client server
cd client && npm create vite@latest . -- --template react-ts
cd ../server && npm init -y && npm install fastify better-sqlite3 @fastify/static && npm install -D typescript tsx @types/node @types/better-sqlite3
cd ..
# create root package.json with orchestration scripts (dev, build, start, test)
# create README.md with ≤3-command setup instructions
# create .env.example with PORT=3000 and DB_PATH=./data/tasks.db
```

After story 1, proceed in the order laid out in *Core Architectural Decisions → Decision Impact Analysis → Implementation sequence* (10 stories total).
