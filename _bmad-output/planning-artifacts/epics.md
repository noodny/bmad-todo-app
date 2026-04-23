---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
workflowStatus: complete
completedAt: 2026-04-23
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
stackDecision: 'UX-spec path (A) — shadcn/ui + Tailwind + Radix + lucide-react; PRD NFR-M1 at 10-dep cap'
---

# bmad-test - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bmad-test, decomposing the requirements from the PRD, UX Design Specification, and Architecture document into implementable stories.

## Requirements Inventory

### Functional Requirements

**Task Management**

- **FR1:** The user can create a new task by entering text and submitting.
- **FR2:** The user can mark an active task as complete.
- **FR3:** The user can mark a completed task as active again (toggle back).
- **FR4:** The user can delete a task, regardless of its completion state.
- **FR5:** A task carries a textual description, up to 200 characters, supplied by the user at creation time.
- **FR6:** A task carries a completion status (active or completed).

**List Presentation**

- **FR7:** The user can view all existing tasks in a single list upon opening the application.
- **FR8:** The system visually distinguishes completed tasks from active tasks without relying on color alone.
- **FR9:** The list presents tasks in a stable order derived from creation timestamp.
- **FR10:** The system displays an empty state when no tasks exist; the empty state contains no tutorial, onboarding modal, or call-to-action beyond the task input field.
- **FR11:** The system displays a loading state while the initial task list is being retrieved.

**Persistence**

- **FR12:** Tasks created by the user persist across browser refreshes and restarts.
- **FR13:** Tasks persist across server restarts without loss.
- **FR14:** The completion state of a task persists through the same mechanisms as the task itself.
- **FR15:** Each task records a creation timestamp that is fixed at creation time and does not change thereafter.

**Error Handling & Recovery**

- **FR16:** The system surfaces an error state when a create, update, or delete operation fails.
- **FR17:** A failed write operation is reported in association with the affected task, so the rest of the list remains usable.
- **FR18:** The user's input is preserved on write failure — failed creations are not silently discarded.
- **FR19:** The user (or system, on their behalf) can retry a failed write operation without producing duplicate tasks.
- **FR20:** The system surfaces loss of connectivity to the user rather than failing silently.

**Accessibility & Interaction**

- **FR21:** The user can create, complete, and delete tasks using only the keyboard.
- **FR22:** Every interactive element has a label accessible to assistive technology.
- **FR23:** Task state changes (creation, completion, deletion) are communicated to assistive technology.
- **FR24:** The application layout renders correctly across viewport widths from 320px to 1920px without horizontal scrolling or overlapping elements.

### NonFunctional Requirements

**Performance**

- **NFR-P1:** First meaningful paint on cold load completes within 1000 ms over broadband.
- **NFR-P2:** Initial task list renders within 200 ms of API response.
- **NFR-P3:** Every task-mutation interaction (create / toggle / delete) produces a visible UI change within 100 ms of user input, via optimistic UI.
- **NFR-P4:** API round-trip time for any single CRUD operation does not exceed 300 ms at the 95th percentile on localhost or same-region deployment.
- **NFR-P5:** Total JavaScript bundle size transmitted to the client, gzipped, does not exceed 100 KB.

**Reliability**

- **NFR-R1:** Task data written to the server survives server process restart, host reboot, and client-side browser restart with zero data loss across a 14-day continuous-use test.
- **NFR-R2:** A write operation interrupted mid-flight resolves to one of three testable outcomes: (a) completes successfully on retry, (b) is marked explicitly as failed in the UI with retry available to the user, or (c) is rolled back from the optimistic update such that the list state matches the server state after reconciliation. Never silent corruption.
- **NFR-R3:** Retry of a failed write is idempotent: a single user intent results in at most one persisted task.
- **NFR-R4:** Under normal operation, the application surfaces zero unhandled errors in the browser console.

**Security**

- **NFR-S1:** Task text supplied by the user is treated as untrusted input and rendered without script execution risk (no XSS via task text).
- **NFR-S2:** No credentials, tokens, or environment secrets are exposed to the client bundle or in client-visible headers, logs, or error responses.
- **NFR-S3:** The backend enforces HTTP method correctness on each endpoint (GET for reads, POST/PUT/PATCH/DELETE for writes as appropriate) — no GET-initiated mutations.
- **NFR-S4:** The application does not embed third-party scripts, analytics, or tracking pixels.

**Accessibility**

- **NFR-A1:** All text content meets WCAG 2.1 AA contrast thresholds (4.5:1 normal text, 3:1 large text / interactive elements).
- **NFR-A2:** The full user journey (create, complete, delete a task) is completable using only a keyboard.
- **NFR-A3:** The application passes an automated accessibility audit (e.g., axe-core, Lighthouse a11y) with zero critical violations on the main view.
- **NFR-A4:** Completed-task visual treatment does not rely on color alone.

**Maintainability**

- **NFR-M1:** Total direct dependencies across frontend and backend combined do not exceed 10 production packages (excluding language stdlib, build tooling, and dev dependencies). Every dependency must be justifiable in writing.
- **NFR-M2:** Frontend, backend, and persistence layer are in clearly separated modules / directories; no cross-layer imports that violate separation (e.g., frontend importing database code).
- **NFR-M3:** The full codebase is readable in a single sitting — targeting under 1000 lines of non-generated, non-vendor source code across frontend and backend combined.
- **NFR-M4:** Setup from fresh clone to running app locally requires no more than three commands and no manual configuration beyond a single config file or environment variable.

### Additional Requirements

*Extracted from Architecture document — technical/infrastructure decisions that shape implementation.*

**Starter Template & Scaffolding**

- **AR1:** First implementation story is project scaffolding using a hybrid scaffold approach: `create-vite` (react-ts template) for the frontend; hand-rolled Fastify + SQLite + TypeScript for the backend. Produces a flat two-package layout: `client/` (Vite + React + TS), `server/` (Fastify + SQLite + TS), and a root `package.json` for orchestration scripts.
- **AR2:** Initial scaffold must include: root `package.json` with `dev`/`build`/`start`/`test` scripts, `README.md` with ≤3-command setup instructions, `.env.example` with `PORT=3000` and `DB_PATH=./data/tasks.db`, `.gitignore` (node_modules, dist, data/*.db, .env).

**Technology Stack (locked)**

- **AR3:** Frontend production dependencies limited to `react` and `react-dom`. Backend production dependencies: `fastify`, `better-sqlite3`, `@fastify/static`. Total = 5 production dependencies. *Note: conflicts with UX spec's shadcn/ui + Tailwind + Radix stack, which would push deps to ~10. See UX-DR section header for resolution.*
- **AR4:** TypeScript across frontend and backend. Node.js 24 LTS on the server. Vite 6+ for the frontend build.
- **AR5:** Backend testing uses Node's built-in `node:test` + `node:assert` (zero deps). Frontend testing uses Vitest + React Testing Library (dev deps only).

**Data Model & Persistence**

- **AR6:** SQLite schema — single `tasks` table with columns `id TEXT PRIMARY KEY` (client-generated UUID v4), `text TEXT NOT NULL CHECK (length(text) <= 200)`, `completed INTEGER NOT NULL DEFAULT 0` (0/1), `created_at INTEGER NOT NULL` (Unix epoch ms, set server-side at first insert). Index `idx_tasks_created_at` on `created_at`.
- **AR7:** Schema applied idempotently at server startup via `CREATE TABLE IF NOT EXISTS`. No migration tooling.
- **AR8:** SQLite configured in WAL mode with fsync on commit for NFR-R1 durability.
- **AR9:** Client-generated UUID (via `crypto.randomUUID()`) is the idempotency key. Server uses `INSERT OR IGNORE` to guarantee NFR-R3 (retry → at most one persisted task).

**API Surface**

- **AR10:** REST over JSON under `/api/` prefix. Four endpoints:
  - `GET /api/tasks` → returns `Task[]` ordered by `created_at ASC`.
  - `POST /api/tasks` body `{ id: UUID, text: string ≤200 }` → returns stored `Task`, idempotent via `INSERT OR IGNORE`.
  - `PATCH /api/tasks/:id` body `{ completed: boolean }` → toggles/sets completion.
  - `DELETE /api/tasks/:id` → idempotent (DELETE of missing id returns 204, not 404).
- **AR11:** API field names use camelCase on the wire (e.g., `createdAt`). SQLite columns use snake_case. Conversion happens exclusively in `server/src/db.ts`.
- **AR12:** API response shape is direct (no `{ data: ..., meta: ... }` envelope). Error responses use Fastify default shape `{ statusCode, error, message }`.
- **AR13:** Dates transmitted as Unix epoch milliseconds (integer) everywhere — DB, wire, client state. No ISO 8601 strings in transit.
- **AR14:** Request validation via Fastify's built-in JSON Schema + ajv (no additional dep). Reject non-`application/json` content types at the Fastify layer.

**Security Baseline**

- **AR15:** Minimal security headers set in a hand-rolled Fastify preHandler (`server/src/security.ts`): `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. No `@fastify/helmet` dependency.
- **AR16:** No authentication in v1 — but all handlers registered under a single `api/` prefix so a future `authenticate` preHandler can be attached globally without rewriting handlers.
- **AR17:** Secrets handled via Node 24 native `--env-file` flag (no `dotenv` dep). Variables: `PORT`, `DB_PATH`.

**Frontend Architecture**

- **AR18:** State management via React built-ins only (`useReducer` for the task list + per-row pending/error status, `useState` for input draft). No Redux / Zustand / Jotai / Context libraries.
- **AR19:** HTTP via native `fetch`. No client library (TanStack Query etc.) — the ~100-LOC custom `useTasks()` hook handles optimistic UI.
- **AR20:** Optimistic UI state model — each task carries a client-only `status: 'synced' | 'pending' | 'failed'` field. Reducer actions follow discriminated union pattern with `OPTIMISTIC_*`, `SYNC_OK`, `SYNC_FAIL`, `RETRY`, `CONNECTIVITY_CHANGED`, `INITIAL_LOAD_*` types.
- **AR21:** Reducer must be pure and immutable — never mutate state in place. Side effects (`fetch`) live in the hook or action creators, never in the reducer.
- **AR22:** No routing library. Single-view SPA with no `react-router-dom`.
- **AR23:** Shared `Task` type duplicated between client and server (~10 lines) rather than introducing workspace tooling or cross-package imports.

**Deployment & Production**

- **AR24:** Production deployment is a single Node process. Fastify serves `/api/*` from route handlers and everything else from `client/dist/` via `@fastify/static` (with SPA-style fallback to `index.html`).
- **AR25:** API routes must register BEFORE `@fastify/static`'s catchall, or API paths will be shadowed by the SPA fallback.
- **AR26:** Development runs two processes (Vite dev on 5173, Fastify on 3000). Vite config proxies `/api/*` → `http://localhost:3000`. Root `package.json` orchestrates both via `node:child_process` (no `concurrently` dep).
- **AR27:** Logging via Fastify's built-in pino. Never log task text (user content) at `info` level — reserve for `debug` only.
- **AR28:** React top-level `ErrorBoundary` catches render-time errors. Node `process.on('uncaughtException')` logs and exits. No silent catches anywhere.

**Project Structure & Conventions**

- **AR29:** Two-package flat layout: `client/` and `server/`. Each with its own `package.json` and `tsconfig.json`. No monorepo tooling (no Turborepo / Nx / pnpm workspaces).
- **AR30:** Colocated tests (`*.test.ts` / `*.test.tsx` next to source). No top-level `tests/` or `__tests__/` directory. No `index.ts` barrel files.
- **AR31:** Strict one-way import direction on the backend: `server.ts → routes/ → db.ts`. `db.ts` is the ONLY file that imports `better-sqlite3`.
- **AR32:** Component organization by role (`components/`, `hooks/`, `state/`, `api/`, `styles/`) on the frontend. No `utils/` or `services/` folders unless a helper has ≥2 consumers.
- **AR33:** Explicitly NOT present: Dockerfile, docker-compose.yml, `.github/workflows/`, `prisma/`, `migrations/`, `drizzle/`, `public/` (client), shared/common package, barrel `index.ts` files.

### UX Design Requirements

*Extracted from UX Design Specification. These are first-class design requirements that generate stories of equal weight to FRs.*

> ⚠️ **Stack conflict to resolve during confirmation:** The UX spec (below) commits to **shadcn/ui + Tailwind CSS + Radix primitives + lucide-react icons** — a ~5-dep frontend that, combined with the 3-dep backend, lands at ~8 prod deps. The Architecture document (AR3) locks the frontend to **plain CSS + React only (5 total prod deps across stack)**. The PRD's NFR-M1 was relaxed from 5 → 10 precisely to accommodate shadcn/ui. **You need to decide which stack wins before story creation.** UX-DRs below assume the shadcn/ui path; architecture-path stories would be a subset.

**Design System Setup**

- **UX-DR1:** Install and initialize shadcn/ui via `npx shadcn@latest init` in the frontend. Configure `components.json` and the canonical shadcn folder structure (`src/components/ui/`).
- **UX-DR2:** Install and configure Tailwind CSS with shadcn's CSS-variable-based theming. Include the shadcn stock utility layer: `class-variance-authority`, `clsx`, `tailwind-merge`.
- **UX-DR3:** Add ONLY these shadcn primitives: `Input`, `Checkbox`, `Button`, `Label`. Explicitly do NOT add: Dialog, Toast, Sonner, Dropdown, Popover, Tooltip, Card, Separator, Select, Combobox, Calendar, DatePicker, Tabs, Accordion, Avatar, Badge, Form, Textarea, RadioGroup, Switch, Slider, Table, Pagination, NavigationMenu, Breadcrumb.
- **UX-DR4:** Install `lucide-react` for icons. Usage limited to four icons: `Check` (inside completed Checkbox, Radix default), `X` (delete affordance), `AlertCircle` (inline row error + load error banner), `WifiOff` (offline banner).

**Design Tokens**

- **UX-DR5:** Define theme CSS variables in `oklch` format. Neutrals: `--background: oklch(1 0 0)`, `--foreground: oklch(0.145 0 0)`, `--muted: oklch(0.97 0 0)`, `--muted-foreground: oklch(0.55 0 0)`, `--border: oklch(0.92 0 0)`, `--input: oklch(0.92 0 0)`.
- **UX-DR6:** Single accent (muted indigo): `--primary: oklch(0.54 0.20 275)`, `--primary-foreground: oklch(0.98 0 0)`, `--ring: oklch(0.54 0.20 275)`. Accent used ONLY for focus rings and the checkbox tick fill.
- **UX-DR7:** Destructive (muted red): `--destructive: oklch(0.57 0.21 25)`, `--destructive-foreground: oklch(0.98 0 0)`. Used ONLY for inline row error indicator and page banner error icon. Never on the delete `×` button.
- **UX-DR8:** No dark mode in v1. No success / info / warning color variables.
- **UX-DR9:** Verify contrast ratios in implementation: foreground on background ~16:1 (AAA), muted-foreground on background ~4.9:1 (AA), primary on background ~4.6:1 (AA), destructive on background ~4.6:1 (AA), primary ring ~4.6:1 (AA, 3:1 needed).

**Typography System**

- **UX-DR10:** Use system font stack only — no Inter or other web-font loading: `font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`. This supports NFR-P1 (zero font-loading time).
- **UX-DR11:** Type scale: Body 16px/1.5 (task rows, input, primary content); Small 14px/1.4 (inline error, over-limit notice); Title 24px/1.25 reserved but likely unused. Weights: 400 regular (body), 500 medium (input value while typing). No bold, no italic, no small caps.

**Layout & Spacing**

- **UX-DR12:** Single-column center-aligned layout with `max-width: 600px`. Horizontal centering via margin auto.
- **UX-DR13:** Desktop (≥768px) vertical structure: `pt-16` (64px top padding), then Input full-width, 32px gap, then List full-width. Horizontal page padding `p-8` (32px).
- **UX-DR14:** Mobile (<768px) vertical structure: `pt-8` (32px top padding), Input full-width, 24px gap, List full-width. Horizontal page padding `p-4` (16px).
- **UX-DR15:** Task row minimum height 44px to meet 44×44 touch target. 8px (`gap-2`) whitespace between rows — no hairline dividers, no card containers.
- **UX-DR16:** No horizontal scrolling at any viewport in [320px, 1920px].

**Responsive Strategy**

- **UX-DR17:** Mobile-first CSS. One width breakpoint: `@media (min-width: 768px)` for desktop treatments. No tablet tier.
- **UX-DR18:** Use capability query `@media (hover: hover)` for hover-reveal affordances (not width query) — covers touch-only laptops and hover-capable tablets correctly.

**TaskInput Component**

- **UX-DR19:** Build `TaskInput` wrapping shadcn `Input`. Full-width within 600px container; 44px minimum height. Visually-hidden shadcn `Label` text "Add a task" via `aria-label` or `<label>` + `htmlFor`.
- **UX-DR20:** Placeholder is the single word `Task`. No instructional copy like "What needs doing?" or "Add a task...".
- **UX-DR21:** Keyboard interaction: Enter submits + clears input + retains focus; Escape clears input + retains focus; Shift+Enter ignored (no multi-line); Tab leaves input and focuses first task row.
- **UX-DR22:** Autofocus input on page mount. Focus stays in input across every mutation.
- **UX-DR23:** Native `maxLength={200}` enforced at input level. If user pastes longer text, render a one-line "Up to 200 characters" notice below input in Small type (14px muted-foreground) that auto-clears on next keystroke or blur.

**TaskList Component**

- **UX-DR24:** Build `TaskList` as semantic `<ul>` with `role="list"`, `aria-live="polite"`, `aria-label="Tasks"`. Render one `TaskRow` per task, sorted by creation timestamp ASC (newest at bottom).
- **UX-DR25:** Loading state (initial fetch): render 3 skeleton rows using `animate-pulse` + `bg-muted`, `aria-hidden="true"`.
- **UX-DR26:** Empty state: render nothing below the input. The placeholder inside `TaskInput` is the only invitation (per FR10).
- **UX-DR27:** Slow-load handling: at 10 s of unresolved initial fetch, show `PageBanner` with "Could not load tasks." and a Retry button.
- **UX-DR28:** Keyboard navigation: Down/Up arrows move focus between rows; Tab also moves forward through rows.

**TaskRow Component**

- **UX-DR29:** Build `TaskRow` left-to-right: shadcn `Checkbox` (visible 16px) wrapped in `p-3.5` container for 44×44 hit area; task text (single line, ellipsis-truncated with `title` attribute for full text on hover); delete affordance (`X` icon from lucide).
- **UX-DR30:** Active state: checkbox unchecked, text in `--foreground`. Completed state: checkbox checked with primary accent tick, text `line-through` + `opacity-60` (two non-color signals for NFR-A4).
- **UX-DR31:** Delete `X` affordance — hover-reveal on desktop (via `@media (hover: hover)`), always visible at reduced opacity on mobile/touch, keyboard-focus-reveal always. Color `--muted-foreground` default; hover changes to `--foreground`.
- **UX-DR32:** Row keyboard interaction: Space toggles completion (focused checkbox); Delete or Backspace removes focused row.
- **UX-DR33:** Focus ring via `focus-within` on `<li>`; 2px offset ring using `--ring` color. Every interactive element shows focus ring on `focus-visible`. Never hide focus indicators.
- **UX-DR34:** Accessibility: Checkbox `aria-labelledby` → task text element; delete button `aria-label="Delete task: {text}"`; row focus-within shows affordances.

**TaskRowError (Variant)**

- **UX-DR35:** Implement as a composed variant of `TaskRow`, not a new component. When a row's status is `failed`: prepend lucide `AlertCircle` icon at row-left in `--destructive` color, replace the `X` delete affordance with a shadcn `Button variant="ghost" size="sm"` labeled `Retry` at row-right. Preserve the task text verbatim.
- **UX-DR36:** Retry interaction: click or Enter re-fires the original mutation using the same client-generated UUID (idempotency key). Success clears error state back to normal row; failure keeps row in error state.
- **UX-DR37:** Accessibility: icon `role="img" aria-label="Save failed"`; retry button `aria-label="Retry saving task: {text}"`; state transitions announced via parent `aria-live`.

**PageBanner Component**

- **UX-DR38:** Build `PageBanner` — rendered above `TaskInput` when active. Horizontal strip: icon + one-line message + optional Retry button. Full-width within 600px container.
- **UX-DR39:** Load-failed variant: `AlertCircle` icon + `Could not load tasks.` + Retry button (`Button variant="outline" size="default"`).
- **UX-DR40:** Offline variant: `WifiOff` icon + `Offline — changes will sync when you reconnect.` No button (recovery is automatic).
- **UX-DR41:** Accessibility: `role="alert"` + `aria-live="assertive"` for immediate announcement. 200ms fade-in, 100ms fade-out.

**Animation & Motion**

- **UX-DR42:** Animation durations and easings: checkbox tick 100ms `ease-out`; strikethrough on text instant (0ms); opacity dim on completed row 100ms `ease-out`; row add instant; row delete instant; delete `X` reveal on hover 150ms `ease-out`; PageBanner fade-in 200ms `ease-out`, fade-out 100ms `ease-in`; focus ring 150ms `ease-out`.
- **UX-DR43:** Respect `prefers-reduced-motion: reduce` — set all animation durations to 0ms under the media query. Nothing spins, pulses, or loops continuously except the loading skeleton during actual loading.
- **UX-DR44:** No bouncy easings anywhere. Only `ease-out` and `ease-in`. Total animation time on any single interaction ≤200ms.

**Button Hierarchy & Copy**

- **UX-DR45:** Never use a filled/primary-accent button anywhere. Accent color is reserved for focus rings and checkbox tick only.
- **UX-DR46:** Copy tone: sentence case only (`Add a task`, never `Add A Task`). No exclamation marks anywhere. No first-person plural "we". No cute copy (`Task`, not `What needs doing?`). Specific over vague (`Could not load tasks.` over `Something went wrong.`). No error codes or debug info in user-facing copy.

**Iconography Rules**

- **UX-DR47:** Only functional icons — no decorative icons, no emoji anywhere. Icon size matches surrounding text size: 16px inline, 20px in PageBanner. Icons always have accessible names (via parent button `aria-label` or `aria-hidden="true"` if truly decorative).

**Explicit Anti-Patterns (forbidden by design)**

- **UX-DR48:** The implementation must NOT include any of: onboarding tour / first-run modal / welcome screen; right-rail or metadata-panel expansion on task click; unread/pending counts in tab title, favicon, or system notifications; confetti / celebration animations / streak badges; auto-hide or auto-archive of completed tasks; confirmation modal on delete; smart sorting / priority inference / "overdue" visual treatment; keyboard-shortcut help overlays; toasts of any kind; context menus; tooltips; hover cards; popovers.

**Focus Management**

- **UX-DR49:** Autofocus input on page mount. After adding a task, focus remains in the input. After deleting a task, focus moves to the previous row (or to input if list is now empty). After an error resolves, focus stays where it was — do not steal focus.

**Accessibility Verification**

- **UX-DR50:** Run axe-core against the deployed main view — zero critical or serious violations. Run Lighthouse accessibility audit — score ≥ 95. One-shot validations at end of implementation, not CI gates.
- **UX-DR51:** Manual keyboard-only pass: complete Journey 1 (add, complete, delete) using only keyboard. Any step that requires mouse is a bug.
- **UX-DR52:** Manual screen reader pass: macOS VoiceOver or Windows NVDA. Confirm input label is announced, task additions announced, completion/deletion announced, errors announced. No unexpected chatter.
- **UX-DR53:** Manual color-blind simulation (Chrome DevTools Rendering → Achromatopsia): completed tasks remain distinct from active via strikethrough + opacity.
- **UX-DR54:** Manual 200% browser zoom pass: no clipping, no layout break, all interactive elements accessible.
- **UX-DR55:** Cross-browser + device test: Chrome, Firefox, Safari (desktop + iOS), Edge — latest 2 versions each. Viewport sweep: 320, 375, 768, 1024, 1440, 1920px. Real-device test on at least one iOS and one Android.

### FR Coverage Map

| FR | Epic | Where covered |
|---|---|---|
| FR1 | 1 | TaskInput + `POST /api/tasks` |
| FR2 | 1 | TaskRow checkbox + `PATCH /api/tasks/:id` |
| FR3 | 1 | Same path as FR2 — uncheck via PATCH |
| FR4 | 1 | Delete `X` affordance + `DELETE /api/tasks/:id` (happy path) |
| FR5 | 1 | 200-char cap: client `maxLength` + Fastify ajv schema + SQLite CHECK |
| FR6 | 1 | `tasks.completed` column |
| FR7 | 1 | `GET /api/tasks` + TaskList render |
| FR8 | 1 | Strikethrough + opacity-60 on TaskRow completed state |
| FR9 | 1 | `ORDER BY created_at ASC` in `db.listTasks` |
| FR10 | 2 | Non-instructive empty state — placeholder inside input only |
| FR11 | 1 | Loading skeleton (3 pulse rows) in TaskList during initial fetch |
| FR12 | 1 | Server-backed SQLite persistence |
| FR13 | 1 | SQLite WAL mode + fsync on commit |
| FR14 | 1 | `completed` column persists through same mechanism |
| FR15 | 1 | `created_at` immutable — `db.updateTask` never touches it |
| FR16 | 2 | TaskRowError variant + PageBanner |
| FR17 | 2 | Per-row `status` field; connectivity banner orthogonal to per-row error |
| FR18 | 2 | Optimistic add moves text into the list row; on failure row persists with `status='failed'` |
| FR19 | 2 | UUID idempotency key + `INSERT OR IGNORE` + idempotent PATCH/DELETE |
| FR20 | 2 | PageBanner offline variant + `useConnectivity` hook |
| FR21 | 1 | Keyboard-full via semantic HTML + Radix primitives + explicit keyboard map |
| FR22 | 1 | `aria-label` or `<label>` on every interactive element |
| FR23 | 1 + 2 | Epic 1: `aria-live="polite"` on TaskList + happy-path state announcements. Epic 2: error-transition announcements. |
| FR24 | 1 | Mobile-first CSS + single 768px breakpoint |

## Epic List

### Epic 1: Task Management & Persistent List (Happy Path)

**Goal:** Deliver the full happy-path todo experience — the user can open the app, add tasks, mark them complete, delete them, and trust that they persist across sessions — on any device, using keyboard or touch.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR11, FR12, FR13, FR14, FR15, FR21, FR22, FR23 (happy-path), FR24

**Scope:**
- Project scaffolding (Vite+React+TS client, Fastify+SQLite+TS server, root orchestration)
- SQLite schema + db module with WAL durability + fsync on commit
- Fastify REST API (`GET/POST/PATCH/DELETE /api/tasks`) + security headers + JSON-schema validation
- shadcn/ui install + theme tokens (CSS variables in `oklch`) + Tailwind config + system-font stack
- TaskInput, TaskList, TaskRow components (active + completed states)
- Mobile-first responsive layout (320–1920px, single 768px breakpoint)
- Semantic HTML + ARIA labels + keyboard navigation + autofocus input + aria-live on TaskList
- Production static serving + build path (`@fastify/static` + SPA fallback)
- Unit tests for reducer, db, and route smoke tests

**Why standalone:** The app is fully usable end-to-end on the happy path — a user can complete Journey 1 (add/complete/delete/persist) without Epic 2 in place. Epic 2 adds resilience on top; it does not rewrite Epic 1.

### Epic 2: Resilience, Empty States & Trust Under Failure

**Goal:** Make the app trustworthy under imperfect conditions — input is never lost on failure, failed writes are clearly marked on the affected row with retry available, and the user knows when they're offline. Verify the accessibility and performance quality bar is met.

**FRs covered:** FR10, FR16, FR17, FR18, FR19, FR20, FR23 (error-state announcements)

**Scope:**
- Non-instructive empty state (placeholder-inside-input as sole invitation)
- Optimistic UI reducer with per-row `status: 'synced' | 'pending' | 'failed'` state model
- TaskRowError variant composition (AlertCircle + preserved text + Retry button)
- PageBanner component with load-failed and offline variants
- `useConnectivity` hook watching `navigator.onLine` + window online/offline events
- Idempotent retry path using the same client-generated UUID
- React top-level ErrorBoundary + Node `uncaughtException` handler + no-silent-catches rule
- Error-state `aria-live` announcements (failure → assertive on PageBanner; per-row via polite)
- Final accessibility verification pass: axe-core (zero critical/serious), Lighthouse (≥95), keyboard-only pass, screen reader pass (VoiceOver or NVDA), color-blind simulation, `prefers-reduced-motion` check, 200% zoom, cross-browser + real-device smoke

**Why standalone:** Layers onto Epic 1 without requiring it to be rewritten. The per-row `status` field and error components are additive. Epic 1 without Epic 2 still works on the happy path; Epic 2 converts it from "works when everything goes right" to "trustworthy under failure."

---

## Epic 1: Task Management & Persistent List (Happy Path)

Deliver the full happy-path todo experience — the user can open the app, add tasks, mark them complete, delete them, and trust that they persist across sessions — on any device, using keyboard or touch. Eight stories take the project from empty directory to a running, responsive, accessibility-baked-in application with a passing test suite.

### Story 1.1: Project Scaffold & Orchestration

As a developer,
I want a working two-package project scaffold with a root orchestration script,
So that I can install dependencies, run the dev server, build, and start the app in ≤3 commands from a fresh clone.

**Acceptance Criteria:**

**Given** a fresh clone of the repo
**When** I run `npm install` at the root
**Then** client and server dependencies are both installed automatically (via a root `postinstall` or explicit install script)

**Given** the installed state
**When** I run `npm run dev`
**Then** the Vite dev server starts on port 5173 **And** the Fastify server starts on port 3000 **And** both run concurrently via a `node:child_process` orchestrator (no `concurrently` dependency)

**Given** the dev state is running
**When** I fetch `http://localhost:5173/api/tasks`
**Then** Vite's dev proxy forwards the request to `http://localhost:3000` and returns the API response

**Given** the installed state
**When** I run `npm run build` at the root
**Then** Vite produces `client/dist/` with hashed asset bundle and `index.html` **And** `tsc` compiles `server/dist/`

**Given** the built state
**When** I run `npm start`
**Then** Fastify runs on port 3000 serving both API and static assets

**Given** the repository root
**When** I inspect the files
**Then** `README.md` documents setup in ≤3 commands **And** `.env.example` exists with `PORT=3000` and `DB_PATH=./data/tasks.db` **And** `.gitignore` excludes `node_modules`, `dist`, `data/*.db`, `.env`

**Given** `client/package.json`
**When** I inspect production dependencies
**Then** only `react` and `react-dom` are listed

**Given** `server/package.json`
**When** I inspect production dependencies
**Then** `fastify`, `better-sqlite3`, and `@fastify/static` are listed (additional frontend deps installed in Story 1.4)

**Given** the root `package.json`
**When** I inspect it
**Then** it has zero production dependencies (orchestration scripts only)

### Story 1.2: Task Persistence Layer (SQLite + Schema + Repository)

As a developer,
I want a durable SQLite persistence layer with a typed repository interface,
So that the server can reliably read and write tasks with guaranteed schema constraints and idempotency.

**Acceptance Criteria:**

**Given** the server starts cold against an empty or missing database file
**When** initialization runs
**Then** a `tasks` table is created idempotently via `CREATE TABLE IF NOT EXISTS` with columns `id TEXT PRIMARY KEY`, `text TEXT NOT NULL CHECK (length(text) <= 200)`, `completed INTEGER NOT NULL DEFAULT 0`, `created_at INTEGER NOT NULL` **And** index `idx_tasks_created_at` on `created_at` exists **And** `PRAGMA journal_mode=WAL` is enabled

**Given** the server data directory does not exist at startup
**When** initialization runs
**Then** the server creates the directory before opening the SQLite file

**Given** an empty database
**When** `listTasks()` is called
**Then** an empty array is returned

**Given** three tasks inserted with distinct `created_at` values
**When** `listTasks()` is called
**Then** the returned array is ordered by `created_at ASC` **And** each element has shape `{ id, text, completed: boolean, createdAt: number }` (camelCase, boolean, epoch ms)

**Given** `createTask({ id, text })` is called with a fresh UUID
**When** the row is inserted
**Then** `created_at` is set server-side to `Date.now()` **And** the returned object has the new `createdAt` value

**Given** `createTask({ id, text })` is called with an id that already exists (retry scenario)
**When** the insert executes via `INSERT OR IGNORE`
**Then** no new row is created **And** the existing stored task is returned unchanged

**Given** an existing task
**When** `updateTask(id, { completed: true })` is called
**Then** `completed` is set to 1 in the DB **And** `created_at` is unchanged (immutable — FR15)

**Given** a task with id X exists
**When** `deleteTask(X)` is called
**Then** the row is removed

**Given** no task with id X exists
**When** `deleteTask(X)` is called
**Then** no error is thrown (idempotent delete)

**Given** tasks were written and the server process is killed
**When** the server restarts and `listTasks()` is called
**Then** the same tasks are returned — durability across process restart is verified (NFR-R1)

**Given** the repository module
**When** I inspect imports across the server package
**Then** `better-sqlite3` is imported ONLY in `server/src/db.ts` **And** snake_case ↔ camelCase conversion happens only in this file

### Story 1.3: Task REST API (GET/POST/PATCH/DELETE)

As the app frontend,
I want a REST API under `/api/tasks` with validated input, idempotent writes, and a security baseline,
So that I can read and mutate tasks reliably and safely over the wire.

**Acceptance Criteria:**

**Given** the server is running
**When** I `GET /api/tasks`
**Then** response status is 200 **And** body is a JSON array of tasks with camelCase fields `{ id, text, completed, createdAt }` ordered by `createdAt ASC`

**Given** the server is running
**When** I `POST /api/tasks` with body `{ id: "<valid-uuid>", text: "buy bread" }` and `Content-Type: application/json`
**Then** the task is persisted **And** the response body is the created task with `createdAt` set **And** response status is 200 or 201 (consistent across endpoints)

**Given** I `POST /api/tasks` with `text` longer than 200 characters
**When** the request is validated
**Then** the server returns 400 **And** the body uses Fastify default error shape `{ statusCode, error, message }`

**Given** I `POST /api/tasks` with missing `id` or missing `text` (or a non-UUID id)
**When** the request is validated
**Then** the server returns 400

**Given** I `POST /api/tasks` with `Content-Type: text/plain`
**When** the request is processed
**Then** the server rejects with 400/415

**Given** I `POST /api/tasks` twice with the same id (client retry)
**When** both requests complete
**Then** no duplicate row is created **And** both responses return the same task (idempotent via `INSERT OR IGNORE`)

**Given** an existing task
**When** I `PATCH /api/tasks/:id` with `{ completed: true }`
**Then** the `completed` field is updated **And** the updated task is returned **And** `createdAt` is unchanged

**Given** no task with :id exists
**When** I `PATCH /api/tasks/:id`
**Then** the server returns 404

**Given** an existing task
**When** I `DELETE /api/tasks/:id`
**Then** response status is 204 **And** the row is removed

**Given** no task with :id exists
**When** I `DELETE /api/tasks/:id`
**Then** response status is 204 (idempotent — never 404)

**Given** the server routing table
**When** I attempt `GET /api/tasks/:id/delete` or any GET-initiated mutation
**Then** no such route exists (NFR-S3 HTTP method correctness)

**Given** a request handled by any route
**When** I inspect the response headers
**Then** `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: same-origin` are present (hand-rolled preHandler, no `@fastify/helmet`)

**Given** a 500 error occurs server-side
**When** the response is sent to the client
**Then** no stack trace or internal detail is exposed in the response body (NFR-S2) **And** the full error is logged server-side via pino at `error` level

**Given** the server request logs
**When** a POST request with task text completes
**Then** the task text is NOT logged at `info` level (privacy hygiene — architecture rule AR27)

**Given** environment configuration
**When** the server starts
**Then** `PORT` and `DB_PATH` are read from `.env` via Node 24's `--env-file` flag **And** sensible defaults are used when unset **And** no third-party `dotenv` dep is installed

### Story 1.4: Frontend Design Foundation (shadcn/ui + Theme + Layout)

As a user,
I want a visually calm, accessible, responsive page shell with design tokens committed,
So that every subsequent feature renders on the same foundation and meets the quality bar from the first interaction.

**Acceptance Criteria:**

**Given** the frontend
**When** I run `npx shadcn@latest init` and accept the canonical configuration
**Then** `components.json` exists at the client root **And** `src/components/ui/` scaffolding exists **And** Tailwind CSS is installed and configured **And** shadcn stock utilities `class-variance-authority`, `clsx`, `tailwind-merge` are installed

**Given** the shadcn add commands are run
**When** I inspect `src/components/ui/`
**Then** `input.tsx`, `checkbox.tsx`, `button.tsx`, `label.tsx` exist **And** NO other shadcn primitives are present (Dialog, Toast, Dropdown, Card, etc. are explicitly absent)

**Given** `client/package.json`
**When** I inspect production dependencies
**Then** `tailwindcss`, `@radix-ui/react-checkbox`, `@radix-ui/react-label`, `@radix-ui/react-slot` (if pulled by shadcn Button), `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react` are listed alongside `react` and `react-dom` **And** total production deps across client + server remain ≤10 (NFR-M1)

**Given** the global CSS or theme file
**When** I inspect the CSS variables
**Then** the following are defined with `oklch(...)` values per UX-DR5-7:
- `--background: oklch(1 0 0)`
- `--foreground: oklch(0.145 0 0)`
- `--muted: oklch(0.97 0 0)`
- `--muted-foreground: oklch(0.55 0 0)`
- `--border: oklch(0.92 0 0)`
- `--input: oklch(0.92 0 0)`
- `--primary: oklch(0.54 0.20 275)`
- `--primary-foreground: oklch(0.98 0 0)`
- `--ring: oklch(0.54 0.20 275)`
- `--destructive: oklch(0.57 0.21 25)`
- `--destructive-foreground: oklch(0.98 0 0)`

**Given** the global font rule
**When** I inspect CSS
**Then** `font-family` uses the system stack `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` **And** NO `@import`, `@font-face`, or external font link is present (zero web-font load — supports NFR-P1)

**Given** no dark-mode configuration
**When** I inspect the theme
**Then** only one (light) theme set of CSS variables exists

**Given** the page renders
**When** I inspect the layout
**Then** content is centered in a single column with `max-width: 600px` **And** horizontal page padding is `p-4` (16px) on mobile **And** horizontal page padding is `p-8` (32px) at `min-width: 768px`

**Given** vertical layout on desktop (≥768px)
**When** measured
**Then** top padding is `pt-16` (64px) **And** gap between input and list is 32px

**Given** vertical layout on mobile (<768px)
**When** measured
**Then** top padding is `pt-8` (32px) **And** gap between input and list is 24px

**Given** viewport widths from 320px to 1920px
**When** the page renders
**Then** no horizontal scroll appears **And** no layout breakage

**Given** `prefers-reduced-motion: reduce` is active
**When** any transition or animation would normally apply
**Then** a corresponding media query sets animation durations to 0ms

**Given** the production build is run
**When** the gzipped JS bundle is measured
**Then** total is ≤100 KB (NFR-P5)

**Given** the built `client/dist/index.html` and all bundled JS
**When** I grep for third-party script sources (`<script src="http`, Google Tag Manager, analytics SDKs, tracking pixels)
**Then** zero matches are found — the app loads only same-origin assets (NFR-S4)

### Story 1.5: TaskInput — Single-Field Entry with Keyboard Commit

As a user,
I want a text input at the top of the page that is already focused and commits on Enter,
So that I can type a task and submit without mouse interaction or visible ceremony.

**Acceptance Criteria:**

**Given** the app loads
**When** the initial mount completes
**Then** TaskInput has focus (cursor blinking) **And** the placeholder `Task` is visible inside the input

**Given** the input is focused and empty
**When** I type characters
**Then** characters render in real time **And** the placeholder disappears once any character is entered

**Given** I have typed up to 199 characters
**When** I type one more
**Then** the input accepts up to exactly 200 characters (native `maxLength={200}`)

**Given** I have typed exactly 200 characters
**When** I type another character
**Then** the character is rejected and no input change occurs

**Given** I paste text longer than 200 characters
**When** the paste resolves
**Then** the input value is truncated at 200 characters **And** a one-line "Up to 200 characters" notice appears below the input in Small type (14px) at `--muted-foreground` color

**Given** the over-limit notice is visible
**When** I type any character or blur the input
**Then** the notice clears

**Given** the input contains non-whitespace text
**When** I press Enter
**Then** `onSubmit(text)` is invoked with the trimmed text **And** the input clears **And** focus remains in the input (ready for the next task)

**Given** the input contains text
**When** I press Escape
**Then** the input clears **And** focus remains in the input

**Given** any input state
**When** I press Shift+Enter
**Then** the action is ignored (no submit, no newline — single-line by design)

**Given** focus is in the input
**When** I press Tab
**Then** focus moves out of the input to the next interactive region (the task list)

**Given** a screen reader is active
**When** I focus the input
**Then** the accessible name "Add a task" is announced (via visually-hidden `<label>` with `htmlFor` OR `aria-label`)

**Given** the input is rendered
**When** its dimensions are measured
**Then** its height is ≥44px **And** it spans the full width of the 600px container

**Given** the input is empty
**When** I press Enter
**Then** no submission occurs and no empty task is created

### Story 1.6: Task List View with Happy-Path CRUD (View / Complete / Delete)

As a user,
I want to see my tasks in a stable list, toggle their completion, and delete them,
So that I can manage my task state with single-click (or keyboard) interactions on any row with instant visible feedback.

**Acceptance Criteria:**

**Given** the app loads for the first time
**When** the initial `GET /api/tasks` fetch is in flight
**Then** TaskList renders 3 skeleton rows with `animate-pulse` and `bg-muted` **And** `aria-hidden="true"` is set

**Given** the initial fetch resolves with N tasks
**When** the list renders
**Then** exactly N `<li>` elements render **And** they are ordered by `createdAt ASC` (newest at bottom)

**Given** the initial fetch returns an empty array
**When** the list renders
**Then** no skeleton rows render and no `<li>` elements render (empty state behavior is fully specified in Story 2.1 — here we only verify the rendering case)

**Given** a task row renders
**When** I inspect its anatomy left-to-right
**Then** it contains a Checkbox (16px visual wrapped in `p-3.5` container yielding 44×44 hit area), the task text (single line, ellipsis-truncated, `title` attribute carrying the full text), and a delete `X` icon at row-right

**Given** an active task
**When** I click its checkbox
**Then** the checkbox tick animates 0→1 scale in 100ms `ease-out` **And** the text gains `line-through` instantly **And** the row opacity transitions to 60% in 100ms `ease-out` **And** a `PATCH /api/tasks/:id` fires with `{ completed: true }`

**Given** a completed task
**When** I click its checkbox
**Then** the tick animates back **And** strikethrough and dim are removed **And** a PATCH fires with `{ completed: false }`

**Given** a row is keyboard-focused (via Tab or arrow key)
**When** I press Space
**Then** the checkbox toggles (same behavior as click)

**Given** a device with `@media (hover: hover)`
**When** I hover over a row
**Then** the delete `X` affordance reveals in 150ms `ease-out` at row-right

**Given** a touch device (no hover capability)
**When** a row renders
**Then** the delete `X` is permanently visible at reduced opacity

**Given** any device
**When** a row gains keyboard focus (`focus-within`)
**Then** the delete `X` is visible regardless of hover state **And** a 2px focus ring appears on the `<li>` using `--ring` color

**Given** the delete `X` is visible
**When** I click it
**Then** the row is removed from the DOM immediately **And** a `DELETE /api/tasks/:id` fires

**Given** a row is keyboard-focused
**When** I press Delete or Backspace
**Then** the same delete flow occurs

**Given** the task text region is clicked (not checkbox, not `X`)
**When** the click lands
**Then** no state change occurs (click on text is a no-op)

**Given** any mutation (add / toggle / delete)
**When** the user action fires
**Then** the visible UI change occurs within 100ms via an optimistic dispatch (OPTIMISTIC_ADD / OPTIMISTIC_TOGGLE / OPTIMISTIC_DELETE) **And** the fetch fires in the background **And** on fetch success `SYNC_OK` dispatches and no visible change occurs (NFR-P3)

**Given** a mutation fetch fails in Epic 1's scope
**When** the error is caught
**Then** the optimistic state is rolled back (row removed on failed add, checkbox flipped back on failed toggle, row restored on failed delete) **And** a `console.error` entry is logged. _Epic 2 Story 2.3 replaces this rollback with a per-row `'failed'` status plus Retry affordance._

**Given** the TaskList `<ul>`
**When** I inspect it
**Then** `role="list"`, `aria-live="polite"`, and `aria-label="Tasks"` are set **And** children are semantic `<li>` elements with stable `key` per task id

**Given** a task is added via OPTIMISTIC_ADD
**When** the list re-renders
**Then** the new `<li>` contains the task text such that `aria-live="polite"` announces the change (FR23 happy-path)

**Given** keyboard focus is on a row
**When** I press ArrowDown
**Then** focus moves to the next row (ArrowUp moves to previous) **And** from the last row ArrowDown stays put (or optionally wraps — pick one and be consistent) **And** from the first row ArrowUp moves focus back to TaskInput

**Given** a completed task
**When** I inspect the DOM styling
**Then** BOTH `line-through` and `opacity-60` are applied (two non-color signals — FR8 / NFR-A4)

**Given** Chrome DevTools Achromatopsia filter is active
**When** I compare active and completed rows
**Then** completion remains distinguishable via strikethrough alone

**Given** the checkbox is rendered
**When** I inspect accessibility attributes
**Then** `aria-labelledby` references the task text element (so a screen reader announces e.g. "buy bread, unchecked")

**Given** the delete button is rendered
**When** I inspect its accessible name
**Then** `aria-label="Delete task: {text}"` is set dynamically with the current text

**Given** a new task created via TaskInput Enter (from Story 1.5)
**When** it appears in the list
**Then** it appears at the bottom with the server-assigned `createdAt` after `SYNC_OK`

**Given** a task text containing HTML-like content (e.g., `<script>alert('xss')</script>` or `<img src=x onerror=alert(1)>`)
**When** the task renders in the list
**Then** the text is displayed as a literal text node (React auto-escape) **And** NO `<script>` executes and NO `<img>` element is created (NFR-S1) **And** `grep -r "dangerouslySetInnerHTML" client/src` returns zero matches

### Story 1.7: Production Build & Single-Origin Serving

As an operator,
I want a single-command production build and single-process runtime,
So that I can deploy the app on one host with no reverse-proxy or edge configuration.

**Acceptance Criteria:**

**Given** I run `npm run build` at the root
**When** it completes
**Then** `client/dist/index.html` and hashed asset files exist **And** `server/dist/server.js` exists

**Given** `server/src/server.ts`
**When** I inspect Fastify plugin/route registration order
**Then** `/api/*` route handlers are registered BEFORE `@fastify/static`'s catchall (AR25)

**Given** `@fastify/static` is configured
**When** it serves static files
**Then** it is rooted at `client/dist/` **And** an SPA-style fallback routes unknown client paths to `index.html`

**Given** I run `npm start` after `npm run build`
**When** the server is up
**Then** `http://localhost:3000/` returns the built `index.html` **And** `http://localhost:3000/api/tasks` returns JSON **And** `http://localhost:3000/some/unknown/client/path` returns `index.html` (SPA fallback)

**Given** the production bundle
**When** measured via `gzip -c | wc -c` or a bundle analyzer
**Then** total transmitted JS is ≤100 KB gzipped (NFR-P5 verified)

**Given** the built application loaded in a browser
**When** I measure First Meaningful Paint over broadband
**Then** FMP is ≤1000 ms (NFR-P1)

**Given** the initial list fetch resolves
**When** I measure time from fetch response to rendered list
**Then** the list paints within 200ms (NFR-P2)

**Given** an add / toggle / delete interaction
**When** I measure from user input event to visible UI change
**Then** the time is ≤100ms (NFR-P3 — optimistic UI)

**Given** a localhost API call (any of the 4 endpoints)
**When** measured at the 95th percentile across 100 calls
**Then** round-trip is ≤300ms (NFR-P4)

**Given** the full non-generated non-vendor source tree (`client/src/**/*.ts{,x}` + `server/src/**/*.ts`)
**When** measured via `wc -l` or equivalent
**Then** total is <1000 lines (NFR-M3)

**Given** the production `npm start` path
**When** the server starts with `DB_PATH` pointing to a non-existent directory
**Then** the server creates the directory before opening the SQLite file

### Story 1.8: Baseline Tests (Reducer + DB + Routes)

As a developer,
I want unit tests for the reducer, db repository, and route handlers,
So that I catch regressions in idempotency, ordering, and state transitions without manual smoke testing.

**Acceptance Criteria:**

**Given** the backend test file `server/src/db.test.ts` exists
**When** I run `node --test server/src/**/*.test.ts`
**Then** all tests pass **And** coverage includes: (a) empty-list returns `[]`, (b) inserted tasks are returned in `created_at ASC`, (c) `INSERT OR IGNORE` with the same id produces a single row, (d) `updateTask` does not modify `created_at`, (e) `deleteTask` of a non-existent id does not throw

**Given** the backend test file `server/src/routes/tasks.test.ts` exists
**When** I run it
**Then** coverage includes: (a) `GET /api/tasks` returns 200 with a JSON array, (b) `POST /api/tasks` with a valid body persists and returns the stored task, (c) `POST` with text >200 chars returns 400, (d) `PATCH /api/tasks/:id` updates completion and returns the updated task, (e) `DELETE /api/tasks/:id` returns 204 for both existing and non-existent ids

**Given** the frontend reducer test file `client/src/state/tasksReducer.test.ts` exists
**When** I run `vitest run`
**Then** tests cover every happy-path reducer action: `INITIAL_LOAD_OK`, `INITIAL_LOAD_FAIL`, `OPTIMISTIC_ADD`, `OPTIMISTIC_TOGGLE`, `OPTIMISTIC_DELETE`, `SYNC_OK` (`SYNC_FAIL`, `RETRY`, `CONNECTIVITY_CHANGED` are added in Epic 2 tests)

**Given** reducer tests
**When** they run
**Then** the reducer is verified as pure (no side effects) **And** state updates are verified as immutable (spread / map / filter, never mutating)

**Given** the test files
**When** I inspect their locations
**Then** they are colocated with source files (`.test.ts` / `.test.tsx` adjacent to the module under test) **And** no top-level `tests/` or `__tests__/` directory exists

**Given** the repo
**When** I run `npm test` at the root
**Then** both server and client test suites execute **And** exit code is 0 on success

**Given** `server/package.json` and `client/package.json`
**When** I inspect dev dependencies
**Then** `vitest` and `@testing-library/react` are in `client/`'s dev deps only **And** `node:test` is used on the server with zero test-runner dependencies

---

## Epic 2: Resilience, Empty States & Trust Under Failure

Layer resilience on top of the happy-path app. Six stories add the non-instructive empty state, per-row failure handling with idempotent retry, connectivity detection, page-level load error banner, global error boundaries, and a final accessibility + quality verification pass. After this epic the app is trustworthy under real-world network conditions and provably meets its a11y + performance bar.

### Story 2.1: Non-Instructive Empty State

As a first-time user (or a user who cleared all tasks),
I want an empty state that invites input without tutorial or CTA clutter,
So that the app starts me in the input field without explaining anything.

**Acceptance Criteria:**

**Given** the initial fetch resolves with an empty array
**When** the list renders
**Then** the `<ul>` exists but contains zero `<li>` children **And** no "Your list is empty" text, no illustration, no CTA button, no sample tasks, and no onboarding modal appear anywhere

**Given** the empty state is active
**When** I inspect the TaskInput
**Then** the placeholder text `Task` is the only visible invitation (FR10 enforced)

**Given** the empty state is active
**When** I inspect the DOM around TaskList
**Then** no tutorial text, onboarding modal, empty-state illustration, or "Add your first task" prompt is present

**Given** the empty state is active
**When** I add a task via TaskInput Enter
**Then** the optimistic add dispatches and the list transitions from empty to single-row without any empty-state-to-content fade artifact

**Given** I delete the last remaining task
**When** the list becomes empty
**Then** the list returns to the empty rendering (zero `<li>`) **And** the input remains focused

### Story 2.2: Initial Load Failure — Page Banner with Retry

As a user returning to the app after a network hiccup,
I want a clear, actionable banner when the initial list fetch fails,
So that I know what happened and can retry without reloading the tab.

**Acceptance Criteria:**

**Given** a new `PageBanner` component exists in `src/components/PageBanner.tsx`
**When** I inspect it
**Then** it renders a horizontal strip above TaskInput with: icon (lucide) at 20px, one-line message in body type, and an optional action Button, full-width within the 600px container

**Given** the initial `GET /api/tasks` call returns a non-2xx status
**When** the reducer receives `INITIAL_LOAD_FAIL`
**Then** the loading skeleton clears **And** PageBanner renders its "load-failed" variant: icon `AlertCircle` in `--destructive` color, copy `Could not load tasks.`, Button `variant="outline" size="default"` labeled `Retry`

**Given** the initial fetch promise rejects at the network level (no server response)
**When** the reducer receives `INITIAL_LOAD_FAIL`
**Then** the same load-failed PageBanner appears

**Given** the initial fetch remains pending at 10 seconds
**When** the slow-load timeout fires
**Then** the same load-failed PageBanner appears (treated as a slow-load failure per UX-DR27)

**Given** the load-failed PageBanner is visible
**When** I click `Retry`
**Then** the fetch re-attempts **And** on success the banner fades out in 100ms `ease-in` **And** the list renders normally

**Given** the PageBanner is visible
**When** I inspect accessibility
**Then** `role="alert"` and `aria-live="assertive"` are set **And** screen readers announce the message immediately

**Given** the PageBanner appears
**When** I measure its entrance animation
**Then** fade-in is 200ms `ease-out` **And** fade-out on dismiss is 100ms `ease-in`

**Given** the PageBanner icon
**When** I inspect it
**Then** it is `lucide-react` `AlertCircle` at 20px in `--destructive` color **And** has `aria-hidden="true"` (the banner's text carries the accessible meaning)

**Given** the PageBanner renders its Button
**When** I inspect imports
**Then** `Button` is sourced from `src/components/ui/button.tsx` (shadcn)

**Given** the full non-generated source after this story
**When** measured
**Then** total LOC remains <1000 (NFR-M3)

### Story 2.3: Per-Row Failure State & Retry (Optimistic UI Upgrade)

As a user whose write failed on spotty wifi,
I want the affected task row to show an inline error indicator and a retry button,
So that I can retry without losing what I typed and without the rest of the list becoming unusable.

**Acceptance Criteria:**

**Given** the reducer
**When** I inspect its action type union
**Then** it includes ALL of `OPTIMISTIC_ADD`, `OPTIMISTIC_TOGGLE`, `OPTIMISTIC_DELETE`, `SYNC_OK`, `SYNC_FAIL`, `RETRY`, `INITIAL_LOAD_OK`, `INITIAL_LOAD_FAIL`, `CONNECTIVITY_CHANGED` as a discriminated union

**Given** the reducer state shape
**When** I inspect a task entry
**Then** each task carries a client-only `status: 'synced' | 'pending' | 'failed'` field **And** this field is never sent to the server and never persisted

**Given** a POST / PATCH / DELETE fetch returns a non-2xx status or rejects at the network layer
**When** the hook dispatches `SYNC_FAIL` with the affected task id
**Then** the task REMAINS in the list (not rolled back — the Epic 1 rollback behavior is replaced) **And** its `status` transitions to `'failed'`

**Given** a task with `status: 'failed'`
**When** TaskRow renders it
**Then** a lucide `AlertCircle` icon in `--destructive` color is prepended at row-left **And** the delete `X` affordance at row-right is REPLACED by a `Button variant="ghost" size="sm"` labeled `Retry` **And** the task text is preserved verbatim

**Given** a failed row
**When** I inspect accessibility
**Then** the icon has `role="img"` with `aria-label="Save failed"` **And** the retry button has `aria-label="Retry saving task: {text}"`

**Given** a failed row
**When** I click Retry (or press Enter while Retry is focused)
**Then** the reducer dispatches `RETRY` **And** the hook re-fires the original mutation using the SAME client-generated UUID **And** the row's status transitions back to `'pending'`

**Given** a retry of a previously failed add
**When** the server handles the POST with the same UUID
**Then** `INSERT OR IGNORE` ensures at most one row is persisted (FR19 / NFR-R3 verified end-to-end)

**Given** a successful retry
**When** `SYNC_OK` dispatches
**Then** the row's status becomes `'synced'` **And** the error icon and Retry button disappear **And** the row reverts to its normal appearance (delete `X` on hover/focus)

**Given** a retry that fails again
**When** `SYNC_FAIL` dispatches again
**Then** the row returns to the `'failed'` visual state **And** the retry cycle can repeat indefinitely

**Given** a row is in `'failed'` state
**When** I inspect sibling rows
**Then** all other rows remain fully interactive — clicking checkboxes, clicking delete, adding new tasks all work normally (FR17 preserved)

**Given** I add a task and the POST fails
**When** the optimistic add dispatches before the fetch
**Then** the typed text is added to the list immediately with `status: 'pending'` **And** after `SYNC_FAIL` the row remains in the list with `status: 'failed'` and the text preserved (FR18 invariant — the list row IS the preservation medium for the input)

**Given** a toggle whose PATCH fails
**When** `SYNC_FAIL` dispatches
**Then** the checkbox state displayed reflects the OPTIMISTIC value (what the user tried to do) **And** Retry re-fires the same PATCH

**Given** a delete whose DELETE request fails
**When** `SYNC_FAIL` dispatches
**Then** the row REAPPEARS in the list with the error indicator **And** Retry re-fires DELETE

**Given** no rows are in failed state
**When** the list renders
**Then** no error icons or Retry buttons are present anywhere

**Given** a screen reader is active
**When** a row transitions into or out of the `'failed'` state
**Then** the aria-live region (TaskList `aria-live="polite"` or the banner's `aria-live="assertive"` where applicable) announces the transition via the text change

### Story 2.4: Connectivity Detection & Offline Banner

As a user on a flaky connection,
I want a persistent banner when the app detects offline state,
So that I understand why writes are failing and know recovery is automatic.

**Acceptance Criteria:**

**Given** a new `src/hooks/useConnectivity.ts` exists
**When** I inspect it
**Then** it attaches `window` `online` and `offline` event listeners on mount **And** reads initial `navigator.onLine` on mount **And** cleans up listeners on unmount

**Given** connectivity transitions to offline
**When** the hook detects it
**Then** the reducer dispatches `CONNECTIVITY_CHANGED({ online: false })` **And** PageBanner renders its "offline" variant: icon `WifiOff` in `--foreground` color, copy `Offline — changes will sync when you reconnect.`, and NO action Button (recovery is automatic)

**Given** the offline banner is visible
**When** connectivity returns (online event fires)
**Then** `CONNECTIVITY_CHANGED({ online: true })` dispatches **And** the banner fades out in 100ms `ease-in`

**Given** a mutation fetch rejects at the network layer (fetch promise rejects, no server response)
**When** the hook handles the failure
**Then** BOTH `SYNC_FAIL` (for the specific row) AND `CONNECTIVITY_CHANGED({ online: false })` are dispatched

**Given** a mutation fetch returns a non-2xx status (server was reachable)
**When** the hook handles it
**Then** ONLY `SYNC_FAIL` dispatches — `CONNECTIVITY_CHANGED` is NOT triggered (per-row error, not connectivity — FR17 × FR20 distinction)

**Given** BOTH a per-row `'failed'` task AND the offline banner are active simultaneously
**When** both render
**Then** they coexist — the banner renders above TaskInput, the row error renders inline — neither subsumes the other

**Given** the offline banner
**When** I inspect accessibility
**Then** `role="alert"` and `aria-live="assertive"` fire the state change to screen readers

**Given** offline is detected during a pending write
**When** connectivity returns later
**Then** the failed row REMAINS in `'failed'` state — the user must click Retry explicitly (no automatic retry in v1 per architecture rule)

**Given** the PageBanner component
**When** I inspect its implementation
**Then** both variants (load-failed and offline) are handled by the same component via a discriminated `variant` prop (not two separate components)

### Story 2.5: Global Error Handling — ErrorBoundary & Uncaught Exceptions

As a user,
I want the app to recover gracefully from unexpected errors,
So that a single buggy render doesn't take down the whole page and a server crash doesn't silently corrupt state.

**Acceptance Criteria:**

**Given** a new `src/ErrorBoundary.tsx` exists
**When** it wraps `<App />` at the React root
**Then** it catches render-time errors in its subtree **And** renders a minimal fallback: one-line message `Something went wrong. Reload the page.` **And** a Reload button that calls `window.location.reload()`

**Given** the ErrorBoundary fallback renders
**When** I inspect its styling
**Then** the visual treatment matches PageBanner (same horizontal strip layout, neutral palette, no color alarm)

**Given** the ErrorBoundary catches an error
**When** I inspect the browser console
**Then** the full error (message + component stack) is logged at `console.error` level

**Given** a normal render path with no thrown errors
**When** the app renders
**Then** ErrorBoundary is transparent — no DOM impact, no event listeners, no logging

**Given** the server's `server.ts` bootstrap
**When** I inspect it
**Then** `process.on('uncaughtException', handler)` is registered **And** the handler logs the error via Fastify's pino at `error` level **And** calls `process.exit(1)` (let the process manager restart)

**Given** the server's `server.ts` bootstrap
**When** I inspect it
**Then** `process.on('unhandledRejection', handler)` applies the same treatment

**Given** the complete codebase (client + server)
**When** I grep for `catch` blocks
**Then** no `catch` block is empty AND no `.catch(() => {})` or equivalent silent-swallow pattern exists (NFR-R4)

**Given** normal app operation through Journey 1 (add/complete/delete happy path)
**When** I monitor the browser console
**Then** zero errors and zero unhandled warnings are printed

**Given** a mutation returns 500
**When** the client handles it
**Then** `SYNC_FAIL` dispatches (Story 2.3) **And** `console.error` logs the failure (visible in devtools for debugging) — NFR-R4 applies to the happy path, not deliberate error paths

### Story 2.6: Accessibility & Quality Verification Pass

As a quality steward,
I want the built app to pass the accessibility, performance, and cross-device quality bar defined in the PRD and UX spec,
So that shipping is gated on objective measurement, not just "looks fine on my laptop."

**Acceptance Criteria:**

**Given** the built application
**When** I run `axe-core` (via CLI or `@axe-core/react` in dev) against the main view
**Then** ZERO critical and ZERO serious violations are reported (NFR-A3)

**Given** the built app in Chrome
**When** I run DevTools Lighthouse accessibility audit
**Then** the score is ≥95

**Given** the built app with keyboard-only input
**When** I perform Journey 1 end-to-end (add a task, complete it, delete it, recover from a simulated inline error, dismiss a load-failed banner)
**Then** every step is completable without mouse input — all affordances reach focus, all actions have keyboard equivalents (FR21, NFR-A2)

**Given** the built app with macOS VoiceOver OR Windows NVDA active
**When** I perform Journey 1
**Then** the input label "Add a task" is announced on focus **And** each task addition is announced via the list's aria-live region **And** each completion toggle produces a state-change announcement **And** each deletion produces a removal announcement **And** a simulated inline error is announced **And** a simulated offline banner is announced

**Given** Chrome DevTools → Rendering → Emulate vision deficiencies → Achromatopsia
**When** I compare active and completed task rows
**Then** completion remains distinguishable via strikethrough plus opacity (no color-only reliance — NFR-A4)

**Given** the browser setting `prefers-reduced-motion: reduce`
**When** I trigger mutations and banner transitions
**Then** all animations drop to 0ms duration **And** no functional regressions occur

**Given** 200% browser zoom on desktop
**When** I render the app
**Then** no content clipping, no layout break, all interactive elements remain accessible

**Given** each contrast pair in the theme
**When** I measure foreground/background, muted-foreground/background, primary/background, destructive/background, and ring/background
**Then** each meets WCAG 2.1 AA (4.5:1 for text, 3:1 for non-text — NFR-A1)

**Given** viewport widths of 320, 375, 768, 1024, 1440, and 1920 px
**When** I render the app at each
**Then** no horizontal scroll appears **And** no layout breakage occurs (FR24)

**Given** Chrome, Firefox, Safari (desktop), Edge, and Safari iOS on their latest 2 versions
**When** I perform Journey 1 on each
**Then** the app works identically with no browser-specific breakage

**Given** at least one real iOS device and one real Android device
**When** I perform Journey 1 on each
**Then** touch targets hit at 44×44 minimum **And** the software keyboard does not break layout **And** the delete affordance is discoverable at reduced opacity on touch

**Given** the verification pass completes
**When** I finalize documentation
**Then** a brief verification record is committed — either in the README or a dedicated `VERIFICATION.md` — documenting what was tested, with what tools, on what browser/device versions, and the date

**Given** NFR-R3 retry idempotency
**When** I simulate 3 consecutive retries of a failed add (disable network, trigger add, re-enable network, click Retry 3 times in sequence)
**Then** exactly 1 task persists on the server (verified via GET /api/tasks or direct SQLite query)

**Given** a 14-day continuous-use test (NFR-R1)
**When** the server has been running through at least one process restart and the client has been refreshed through at least one browser restart
**Then** zero tasks are lost, zero tasks are duplicated, and all `createdAt` timestamps match the original values


