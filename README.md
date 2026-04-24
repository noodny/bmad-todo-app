# bmad-test

Minimalist, reference-quality single-user todo app. Two-package flat layout (`client/` + `server/`) with a root orchestration script.

## Requirements

- Node.js 24 LTS
- npm 10+ (ships with Node 24)

## Setup (≤3 commands)

**Development:**

```bash
npm install
npm run dev
```

That gives you:

- Vite dev server on <http://localhost:5173> (UI, with HMR)
- Fastify API on <http://localhost:3000>
- Vite proxies `/api/*` requests to the Fastify server, so the browser talks only to `:5173`

**Production:**

```bash
npm install
npm run build
npm start
```

The Fastify server on port 3000 serves both the `/api/*` surface and the built Vite bundle from `client/dist/` (with SPA fallback to `index.html`).

## Configuration

Two environment variables, read by the server:

| Variable  | Default              | Purpose                           |
| --------- | -------------------- | --------------------------------- |
| `PORT`    | `3000`               | Port the Fastify server binds to  |
| `DB_PATH` | `./data/tasks.db`    | SQLite file location (Story 1.2+) |

See `.env.example` for the template. Copy it to `server/.env` and edit as needed.

## Layout

```
bmad-test/
├── package.json          # root orchestration only (no prod deps)
├── scripts/dev.mjs       # spawns client + server in parallel (no `concurrently` dep)
├── client/               # Vite + React + TypeScript
└── server/               # Fastify + better-sqlite3 + TypeScript
```
