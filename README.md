# bmad-test

Minimalist single-user todo app. Two-package flat layout (`client/` + `server/`) with a root orchestration script. Built end-to-end through the [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) AI-assisted workflow as a learning exercise.

## Setup — Docker Compose (recommended)

The repo ships a [docker-compose.yml](docker-compose.yml) with three mutually-exclusive profiles: `prod` (nginx + Fastify), `dev` (Vite HMR + tsx watch), and `test` (one-off test runners). Picking a profile is the only required configuration step.

### One-time

```bash
cp .env.docker.example .env   # makes `prod` the implicit default profile
```

### Production (nginx + hardened backend)

```bash
docker compose --profile prod up --build
```

- App on **<http://localhost:8080>** (nginx serves the SPA, proxies `/api/*` to the backend).
- Backend on the internal `bmad-net` network only — port 3000 is **not** exposed to the host.
- Both services run non-root, with `read_only: true`, `cap_drop: ALL`, and `no-new-privileges:true`. Memory and PID caps are set; rotated json-file logs.
- SQLite data lives on the named volume `bmad-test-tasks-data`.

### Dev (HMR + live reload)

```bash
docker compose --profile dev up --build
```

- Vite dev server on **<http://localhost:5173>**, proxying `/api/*` to the dev backend.
- Backend (`tsx watch`) on **<http://localhost:3000>**.
- `client/src/`, `server/src/`, and the Vite/tsconfig files are bind-mounted, so edits hot-reload without rebuilding the image.

### Tests (one-shot)

```bash
docker compose --profile test run --rm test-server
docker compose --profile test run --rm test-client
```

### Knobs

Every override is in [.env.docker.example](.env.docker.example): `IMAGE_TAG`, `FRONTEND_PORT`, `BACKEND_MEM_LIMIT`, `LOG_LEVEL`, etc. All are optional.

### Health probes

- Backend: `GET /health` (liveness, no I/O) and `GET /health/ready` (readiness, hits the DB).
- Frontend (nginx): `GET /healthz`.
- Both wired into compose `healthcheck:` blocks; the prod frontend `depends_on: backend.condition: service_healthy`.

## Setup — Local Node (without Docker)

Requires **Node.js 24 LTS** (npm 10+ ships with it).

```bash
npm install
npm run dev          # Vite on :5173 + Fastify on :3000, with proxy
# or
npm run build && npm start   # Fastify serves both the API and the built SPA on :3000
```

Two env vars, read by the server (see [server/.env.example](server/.env.example)):

| Variable  | Default           | Purpose                          |
| --------- | ----------------- | -------------------------------- |
| `PORT`    | `3000`            | Port the Fastify server binds to |
| `DB_PATH` | `./data/tasks.db` | SQLite file location             |

## Layout

```
bmad-test/
├── package.json                # root orchestration only (no prod deps)
├── docker-compose.yml          # prod / dev / test profiles
├── scripts/dev.mjs             # spawns client + server in parallel (no `concurrently` dep)
├── client/                     # Vite + React + TypeScript + Playwright
├── server/                     # Fastify + better-sqlite3 + TypeScript
├── docs/                       # security review, etc.
├── verification/               # accessibility + verification artifacts
├── _bmad/                      # BMAD framework + agent definitions (committed)
└── _bmad-output/               # planning + per-story artifacts (committed)
```

---

## AI assistance — what was used and how

Every story (1.1 through 2.6) was scoped, implemented, reviewed, and retrospected with an LLM agent in the loop through BMAD.

### Agent Usage

**Tasks completed with AI assistance:** essentially all of them. The structure was BMAD's planning → architecture → epics/stories → dev → review → retro pipeline.

Steps 3 and 4 (docker compse and QA) were performed using direct Claude Code prompts with simple specs.

### MCP Server Usage

**`chrome-devtools-mcp`** — used in the verification pass to run:

- Lighthouse a11y audits driven from the agent loop (4 runs: desktop/mobile × empty/populated). All four scored 100. Reports in [verification/lighthouse-\*.html](verification/).
- axe-core 4.10.2 staged into the static dir and run against three live UI states (empty list, populated, load-failed banner). 0 critical / 0 serious in all three states.
- Keyboard-only Journey 1: Tab/Space/Enter/Delete/ArrowDown driven through the actual app, focus state read after each step. Confirmed the Phase B1 focus-after-delete fix from Story 2.6.
- Viewport sweep at 320 / 375 / 768 / 1024 / 1440 / 1920 px via `emulate viewport`. PNGs at [verification/viewport-\*.png](verification/).
- Contrast pair measurement: tokens resolved through a 1×1 canvas to read actual rendered RGB pixels, then luminance ratios computed in-page per the WCAG 2.1 formula.

What it can't do (recorded as `🟡 TBD-by-human` in [VERIFICATION.md](VERIFICATION.md)): drive a real screen reader (AC4), test Firefox / Safari / Edge / iOS Safari (AC10), or sign off on real iOS + Android devices (AC11). It also doesn't expose `Emulation.setEmulatedMedia` for `prefers-reduced-motion`, so AC6 was static-verified by reading the loaded stylesheet at runtime.

### Test Generation

**Stack:** Vitest (client unit), `tsx --test` (server unit), Playwright (e2e) - for this simple project all test cases were AI generated. The testing setup was unfortunately omitted in the initial spec and thus added later on.
