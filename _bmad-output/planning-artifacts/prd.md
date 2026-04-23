---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
workflowStatus: complete
completedAt: 2026-04-23
inputDocuments:
  - docs/initial-prd.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
successCriteriaLayers:
  - product-success
  - quality-success
  - meta-success
testBedContext: true
---

# Product Requirements Document - bmad-test

**Author:** Chris
**Date:** 2026-04-21

## Executive Summary

A single-user, full-stack todo web application that serves as a reference-quality implementation of the minimal task-management pattern. The product supports create, view, complete, and delete operations on personal todo items via a responsive frontend and a small REST API backed by durable storage. Target user is a single individual (the author) operating on their own device. The problem being addressed is not novel — personal task tracking — and the product's purpose is to demonstrate that the familiar pattern can be executed with discipline: no auth, no sync, no secondary features, no accretion.

### What Makes This Special

The product's differentiator is its deliberate minimalism. Where most todo applications grow priorities, tags, deadlines, reminders, sharing, and integrations, this one commits to the core loop and stops. The value proposition is twofold: (1) for the end user, an interaction surface small enough to be fully understood in under ten seconds of first use; (2) for any developer reading the codebase, an architecture small enough to hold in working memory, with clear separation between UI, API, and persistence. "Done" is a design goal.

## Project Classification

- **Project Type:** Web application (full-stack — responsive frontend + REST API + persistent storage)
- **Domain:** General (no regulated or specialized domain concerns)
- **Complexity:** Low
- **Project Context:** Greenfield

## Success Criteria

### User Success

The single user (the author) can:
- **First-use speed:** Complete the full core loop — add a task, mark it complete, delete a task — in under 10 seconds on first encounter with the app, without reading instructions, labels beyond what's on-screen, or tooltips.
- **Persistence confidence:** Close the browser, return hours or days later, and find the exact same task list. No data loss over a minimum two-week continuous-use period.
- **Perceived responsiveness:** Every interaction (add, toggle complete, delete) produces a visible UI response within 100ms of input. No spinners on the core loop under normal network conditions.

### Business Success

No revenue, users, or growth targets apply. The test-bed equivalent:

- **Buildability:** A downstream developer (or BMad dev agent) can implement this PRD end-to-end with no more than two clarification round-trips. Clarification on API response shape is acceptable; clarification on what the product is for means the PRD failed.
- **PRD-to-working-software latency:** From locked PRD to deployed, demo-able application in under one working day of focused implementation.

### Technical Success

- **API correctness:** All CRUD operations return the expected resource state; list reflects every mutation without reload.
- **Persistence durability:** No data corruption or loss across server restart, client refresh, or network interruption mid-write.
- **Responsive layout:** Renders correctly without horizontal scroll or layout breakage on viewports from 320px (mobile) to 1920px (desktop).
- **Error surfaces:** Every user-facing failure mode (network error, server error, empty state, loading state) has an intentional, non-embarrassing UI treatment.
- **Console cleanliness:** Zero errors and zero unhandled warnings in browser console under normal use.

### Measurable Outcomes

| Metric | Target |
|---|---|
| Time-to-first-completed-task (new user) | < 10 seconds |
| Perceived UI response latency | < 100ms |
| Data loss events across 2-week test | 0 |
| Console errors under normal use | 0 |
| Viewport breakage | None between 320px–1920px |
| PRD clarification round-trips during dev | ≤ 2 |

## Product Scope

### MVP — Minimum Viable Product

Everything in this PRD **is** the MVP. There is no post-MVP phase.

- Create a todo (short text)
- List todos (active + completed, visually distinct)
- Mark a todo complete / uncomplete
- Delete a todo
- Metadata: creation timestamp, completion status
- Responsive UI (desktop + mobile)
- Empty, loading, and error UI states
- Persistent storage via backend API
- Basic error handling (client and server)

### Growth Features (Post-MVP)

**None.** The product's thesis is that "done" is a design goal. The following are explicitly refused, even if requested later within this project:

- User accounts / authentication
- Multi-device sync
- Priorities, tags, categories
- Due dates, reminders, notifications
- Search, filtering
- Sharing, collaboration
- Undo / history
- AI / natural language input

If any of these become desirable, the answer is a *new* product, not an extension of this one.

### Vision (Future)

N/A. The vision *is* the MVP, delivered cleanly. Architectural provisions for future extension (noted in the initial brief) are scoped narrowly to "don't actively block a future auth layer" — not "build for imagined extensions."

## User Journeys

### Persona

**Chris** — the author and sole user of the application. Runs the app on his own machine or a personal deployment. Uses it to track personal tasks that would otherwise sit in a text file or in his head. Does not need it to sync, share, or notify. Cares that it is fast, always there, and visually unembarrassing.

### Journey 1 — Happy Path: Adding and Completing a Task

**Opening:** Chris has three things he wants to remember to do this afternoon. He opens the app in his browser. The list is empty from a previous cleanup; a neutral empty state greets him — no tutorial, no onboarding, no "welcome" modal.

**Action:** He clicks into the input at the top of the list, types `buy bread`, and hits Enter. The task appears in the list immediately — no spinner, no perceptible delay. He types the next two tasks the same way.

**Climax:** An hour later, he's back from the shop. He clicks the checkbox next to `buy bread`. The row transitions to the completed visual style (strikethrough, dimmed) within 100ms. He feels the small satisfaction of the tick.

**Resolution:** At the end of the day, two completed tasks remain in the list. He clicks each one's delete affordance; they vanish. The remaining active task persists for tomorrow.

**Requirements revealed:**
- Single-field task entry, Enter-to-submit
- Optimistic UI update on add/toggle/delete
- Visual distinction between active and completed states
- Per-row complete-toggle and delete affordances
- Non-instructive empty state

### Journey 2 — Edge Case: Network Interruption Mid-Write

**Opening:** Chris is on a flaky train wifi. He opens the app; the list loads correctly from the last session.

**Action:** He types `email Sarah about the contract` and hits Enter. The client optimistically shows the task in the list. The API call fails — train wifi dropped.

**Climax:** The row transitions to a visibly distinct "failed to save" state — not a modal, not a toast that disappears, a persistent inline indicator on the affected row with a retry affordance. The rest of the list stays usable. Chris does not lose what he typed.

**Resolution:** Wifi comes back. Chris clicks retry (or the app auto-retries — a decision to settle in technical detail later). The row saves, the failure state clears. No duplicate row is created.

**Requirements revealed:**
- Optimistic UI with explicit rollback or retry on API failure
- Per-row error state distinct from global error state
- No lost input on failure
- Idempotency or de-duplication for retry

### Journey 3 — Edge Case: Returning After Time Away

**Opening:** Chris hasn't used the app in nine days. He had five active tasks and three completed tasks when he last closed the tab.

**Action:** He opens the URL. Brief loading state (empty list skeleton or spinner), then the full list appears: five active tasks at top, three completed below (or intermixed with distinct styling — a visual-design decision to settle later).

**Climax:** The tasks are **exactly** as he left them — same order (by creation timestamp), same text, same completion states. Nothing silently disappeared or reordered.

**Resolution:** He deletes the three completed tasks to clean up, adds one new task, and gets on with his day.

**Requirements revealed:**
- Server-backed persistent storage (not browser-local)
- Durable ordering by creation timestamp (stable across fetches)
- Loading state during initial fetch
- Session-independent data — no "session timeout"

### Journey Requirements Summary

| Capability | Revealed by |
|---|---|
| Single-field task entry with Enter submit | J1 |
| Optimistic UI for add / toggle / delete | J1, J2 |
| Visual distinction: active vs. completed | J1 |
| Per-row complete-toggle affordance | J1 |
| Per-row delete affordance | J1 |
| Non-instructive empty state | J1 |
| Inline per-row error state with retry | J2 |
| No-lost-input on write failure | J2 |
| Idempotent write / de-duplication on retry | J2 |
| Durable server-side persistence | J3 |
| Stable ordering by creation timestamp | J3 |
| Loading state on initial fetch | J3 |
| No session / auth / timeout mechanics | J3 (implicit) |

## Web Application Specific Requirements

### Project-Type Overview

A single-page web application (SPA) with a small REST API backend. The frontend is the primary interface; the backend exists solely to persist data durably. No server-rendered pages, no public-facing content, no multi-user infrastructure. Target runtime is a modern browser on a personal device (desktop or mobile).

### Technical Architecture Considerations

- **Client rendering model:** Single-page application. The entire UI lives in one document; navigation, state, and rendering are client-side. Chosen over MPA because the app is a single list view with live optimistic updates — MPA would add complexity without benefit.
- **Client-server separation:** Frontend and backend are independently deployable, but the expected deployment is a single co-located unit (same host or trivially proxied). The API is not designed for third-party consumers.
- **State model:** In-memory client state hydrated from API on load, kept in sync via optimistic updates and eventual reconciliation on write.

### Browser Matrix

Support scope is intentionally narrow:

| Browser | Minimum Version |
|---|---|
| Chrome | Latest 2 major versions |
| Firefox | Latest 2 major versions |
| Safari | Latest 2 major versions (desktop + iOS) |
| Edge | Latest 2 major versions |

Explicit non-goals: Internet Explorer, legacy Safari, Opera Mini, in-app webviews with non-standard behavior. The product will not ship polyfills or shims for older engines.

### Responsive Design

- **Viewport range:** 320px (narrow mobile) to 1920px (desktop wide) — no layout breakage within this range.
- **Breakpoints:** One breakpoint (mobile vs. non-mobile) is sufficient. The single-column list layout collapses gracefully without needing tablet-specific treatment.
- **Touch targets:** Interactive elements (checkbox, delete button) must meet 44×44px minimum hit-target on mobile.
- **No separate mobile layout:** Same DOM, same interactions, responsive CSS only.

### Performance Targets

Measurable targets are authoritative in *Non-Functional Requirements → Performance* (NFR-P1 through NFR-P5). The design intent: prefer a small, tree-shakable stack over an all-in-one framework, so the bundle-size and latency caps are met as a natural consequence of stack choice rather than a tuning exercise.

### SEO Strategy

**Not applicable.** This is a personal, single-user application with no public content. The document may ship a basic `<title>` and no-index meta tag, but structured data, sitemaps, Open Graph, and server-side rendering for crawlers are all out of scope.

### Accessibility Level

**Target: best-effort conformance to WCAG 2.1 AA fundamentals, not formal certification.** Specifically:

- Semantic HTML (proper `<ul>`, `<li>`, `<button>`, `<input type="checkbox">`, `<label>` — no `<div>`-as-button).
- Full keyboard navigation: tab order is logical; Enter submits; Space toggles checkboxes; Escape clears input focus where appropriate.
- Every interactive element has a discernible label (visible text or `aria-label`).
- Color contrast meets 4.5:1 for text, 3:1 for interactive elements.
- Completed-task styling does not rely on color alone — strikethrough or opacity provides non-color signal.
- Screen reader announces task additions, completions, and deletions (via `aria-live` on the list region).

Explicit non-goals: full WCAG certification, automated a11y test gates in CI, user testing with assistive-tech users. "Would not embarrass me if a screen-reader user tried it" is the bar.

### Implementation Considerations

- **No offline mode** — the app requires network connectivity to read or write. If offline, the app shows a clear offline state. Service worker / local-cache support is out of scope.
- **No PWA manifest** — not installable as a standalone app. It's a webpage.
- **No analytics, no telemetry, no tracking pixels.**
- **No CDN or edge assumptions** — the app should work when deployed to a single origin with no edge caching.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** "Finished Product" MVP — not a problem-validation MVP, not a learning MVP, not a vertical slice of a larger roadmap. This is the entire intended product, delivered at quality, with no post-MVP phase planned or desired.

**Rationale for this choice:** The product's thesis is minimalism. A "learning MVP" framing would smuggle in the assumption that we'll discover what to add later — but we are explicitly committed to *not* adding later. Treating this as a finished product from day one keeps the quality bar high and the scope defensible.

**Resource Requirements:** One developer (human or agent), approximately one focused working day of implementation. Stack choices should favor the smallest set of dependencies that achieves the success criteria — heavy frameworks (Next.js + Redux + Prisma + ORM migrations + Docker Compose for a five-endpoint app) would violate the product's own thesis.

### Risk Mitigation Strategy

**Technical Risks**

The main technical risk is **over-engineering**. For a five-endpoint CRUD app, the temptation to reach for heavyweight frameworks, ORMs, migration systems, or container orchestration is real — and directly contradicts the product's thesis.

*Mitigation:* The architecture decisions in the downstream Architecture document must justify every dependency. Default should be "use the language's standard library + one thin framework" unless a specific requirement forces otherwise. If the tech stack grows past ~5 direct dependencies total (frontend + backend combined), that's a smell worth revisiting.

A secondary technical risk is **persistence choice paralysis**. SQLite, Postgres, JSON file, key-value store all work for this product. *Mitigation:* pick the one with the fewest operational moving parts given the chosen deployment target. "Works on one host with zero external services" is the bar.

**Market Risks**

Not applicable — no market. The workflow-equivalent risk is that the **PRD produces unbuildable output**: the dev agent comes back with repeated clarification requests, or builds something that doesn't match. *Mitigation:* that's what this entire document is being tested against. The Measurable Outcome target of ≤2 clarification round-trips during dev is the specific gate.

**Resource Risks**

If implementation time is constrained below the one-day estimate, *do not cut error states, persistence, or the responsive layout*. Those define "reference-quality." Acceptable cuts in a time-crunch: minor visual polish, the inline retry affordance (fall back to full-row error state with page-reload recovery), touch-target perfection on non-critical controls. Unacceptable cuts: anything that would make a reader of the finished product say "this was rushed."

## Functional Requirements

### Task Management

- **FR1:** The user can create a new task by entering text and submitting.
- **FR2:** The user can mark an active task as complete.
- **FR3:** The user can mark a completed task as active again (toggle back).
- **FR4:** The user can delete a task, regardless of its completion state.
- **FR5:** A task carries a textual description, up to 200 characters, supplied by the user at creation time.
- **FR6:** A task carries a completion status (active or completed).

### List Presentation

- **FR7:** The user can view all existing tasks in a single list upon opening the application.
- **FR8:** The system visually distinguishes completed tasks from active tasks without relying on color alone.
- **FR9:** The list presents tasks in a stable order derived from creation timestamp.
- **FR10:** The system displays an empty state when no tasks exist; the empty state contains no tutorial, onboarding modal, or call-to-action beyond the task input field.
- **FR11:** The system displays a loading state while the initial task list is being retrieved.

### Persistence

- **FR12:** Tasks created by the user persist across browser refreshes and restarts.
- **FR13:** Tasks persist across server restarts without loss.
- **FR14:** The completion state of a task persists through the same mechanisms as the task itself.
- **FR15:** Each task records a creation timestamp that is fixed at creation time and does not change thereafter.

### Error Handling & Recovery

- **FR16:** The system surfaces an error state when a create, update, or delete operation fails.
- **FR17:** A failed write operation is reported in association with the affected task, so the rest of the list remains usable.
- **FR18:** The user's input is preserved on write failure — failed creations are not silently discarded.
- **FR19:** The user (or system, on their behalf) can retry a failed write operation without producing duplicate tasks.
- **FR20:** The system surfaces loss of connectivity to the user rather than failing silently.

### Accessibility & Interaction

- **FR21:** The user can create, complete, and delete tasks using only the keyboard.
- **FR22:** Every interactive element has a label accessible to assistive technology.
- **FR23:** Task state changes (creation, completion, deletion) are communicated to assistive technology.
- **FR24:** The application layout renders correctly across viewport widths from 320px to 1920px without horizontal scrolling or overlapping elements.

## Non-Functional Requirements

### Performance

- **NFR-P1:** First meaningful paint on cold load completes within **1000 ms** over broadband.
- **NFR-P2:** Initial task list renders within **200 ms** of API response.
- **NFR-P3:** Every task-mutation interaction (create / toggle / delete) produces a visible UI change within **100 ms** of user input, via optimistic UI.
- **NFR-P4:** API round-trip time for any single CRUD operation does not exceed **300 ms** at the 95th percentile on localhost or same-region deployment.
- **NFR-P5:** Total JavaScript bundle size transmitted to the client, gzipped, does not exceed **100 KB**.

### Reliability

- **NFR-R1:** Task data written to the server survives server process restart, host reboot, and client-side browser restart with **zero data loss** across a 14-day continuous-use test.
- **NFR-R2:** A write operation interrupted mid-flight (network failure, server crash) resolves to one of three testable outcomes: (a) completes successfully on retry, (b) is marked explicitly as failed in the UI with retry available to the user, or (c) is rolled back from the optimistic update such that the list state matches the server state after reconciliation. Never silent corruption.
- **NFR-R3:** Retry of a failed write is idempotent: a single user intent results in at most one persisted task.
- **NFR-R4:** Under normal operation, the application surfaces zero unhandled errors in the browser console.

### Security

Minimal security surface — no auth, no PII, no payment data — but basic web hygiene is required:

- **NFR-S1:** Task text supplied by the user is treated as untrusted input and rendered without script execution risk (no XSS via task text).
- **NFR-S2:** No credentials, tokens, or environment secrets are exposed to the client bundle or in client-visible headers, logs, or error responses.
- **NFR-S3:** The backend enforces HTTP method correctness on each endpoint (GET for reads, POST/PUT/PATCH/DELETE for writes as appropriate) — no GET-initiated mutations.
- **NFR-S4:** The application does not embed third-party scripts, analytics, or tracking pixels.

### Accessibility

Specifics already documented in *Web Application Specific Requirements → Accessibility Level*. Restated here as measurable NFRs:

- **NFR-A1:** All text content meets **WCAG 2.1 AA contrast** thresholds (4.5:1 normal text, 3:1 large text / interactive elements).
- **NFR-A2:** The full user journey (create, complete, delete a task) is completable using only a keyboard.
- **NFR-A3:** The application passes an automated accessibility audit (e.g., axe-core, Lighthouse a11y) with **zero critical violations** on the main view.
- **NFR-A4:** Completed-task visual treatment does not rely on color alone.

### Maintainability

These NFRs are the concrete form of the product's "reference-quality" thesis:

- **NFR-M1:** Total direct dependencies across frontend and backend combined do not exceed **10 production packages** (excluding language stdlib, build tooling, and dev dependencies). Every dependency must be justifiable in writing. *Budget relaxed from an initial cap of 5 after the UX Design step adopted shadcn/ui + Radix primitives, which land the frontend at ~5–6 prod deps on their own; each Radix primitive is justified as replacing hand-written accessibility code.*
- **NFR-M2:** Frontend, backend, and persistence layer are in clearly separated modules / directories; no cross-layer imports that violate separation (e.g., frontend importing database code).
- **NFR-M3:** The full codebase is readable in a single sitting — targeting **under 1000 lines** of non-generated, non-vendor source code across frontend and backend combined.
- **NFR-M4:** Setup from fresh clone to running app locally requires no more than **three commands** and no manual configuration beyond a single config file or environment variable.

### Explicit Exclusions

- **Scalability NFRs** — deliberately omitted. Single user, no growth trajectory.
- **Integration NFRs** — deliberately omitted. No external systems.
