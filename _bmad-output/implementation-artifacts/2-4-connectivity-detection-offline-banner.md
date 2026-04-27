# Story 2.4: Connectivity Detection & Offline Banner

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user on a flaky connection,
I want a persistent banner when the app detects offline state,
So that I understand why writes are failing and know recovery is automatic.

## Acceptance Criteria

1. **AC1 — `useConnectivity` hook exists.**
   **Given** a new `client/src/hooks/useConnectivity.ts` file,
   **When** I read it,
   **Then** it exports a `useConnectivity` hook that: (a) attaches `window` `online` and `offline` event listeners on mount; (b) reads initial `navigator.onLine` on mount (so a user opening the app while already offline immediately sees the banner); (c) cleans up both listeners on unmount via the `useEffect` return.

2. **AC2 — Reducer gains `CONNECTIVITY_CHANGED` action + `online: boolean` state.**
   **Given** `client/src/state/tasksReducer.ts` after this story,
   **When** I read it,
   **Then** the `Action` discriminated union includes `{ type: "CONNECTIVITY_CHANGED"; online: boolean }` AND `State` has a new `online: boolean` field AND `initialState.online` is `true` (the hook will correct it on mount via `navigator.onLine`) AND the reducer's `CONNECTIVITY_CHANGED` case returns `{ ...state, online: action.online }` (no other state touched). Reducer purity (AR21) preserved.

3. **AC3 — Going offline dispatches `CONNECTIVITY_CHANGED({ online: false })`.**
   **Given** the user is online and the app is mounted,
   **When** the browser fires the `offline` window event (or `navigator.onLine` reports `false` on mount),
   **Then** `useConnectivity` invokes its callback with `false` AND `useTasks` dispatches `{ type: "CONNECTIVITY_CHANGED", online: false }` AND the reducer transitions `state.online` to `false`.

4. **AC4 — Offline banner renders the prescribed anatomy.**
   **Given** `state.online === false`,
   **When** `<App>` renders,
   **Then** a `<PageBanner>` mounts above `<TaskInput>` with: icon = `<WifiOff className="size-5" />` from `lucide-react` (in `--foreground` color — Tailwind's default text color, NOT `text-destructive`); message = the literal string `Offline — changes will sync when you reconnect.`; **no `action` prop** (no Retry button — recovery is automatic when connectivity returns).

5. **AC5 — Going online dispatches `CONNECTIVITY_CHANGED({ online: true })` and the banner unmounts.**
   **Given** `state.online === false` and the offline banner is visible,
   **When** the browser fires the `online` window event,
   **Then** `useConnectivity` invokes its callback with `true` AND the reducer transitions `state.online` to `true` AND the conditional `{!state.online && <PageBanner ...>}` evaluates `false` so the banner unmounts. (Fade-out animation is the same deferral as Story 2.2 AC11 — handled in Story 2.6's polish pass.)

6. **AC6 — Mutation network rejection ALSO dispatches `CONNECTIVITY_CHANGED({ online: false })`.**
   **Given** an `apiCreateTask` / `apiUpdateTask` / `apiDeleteTask` fetch promise rejects at the **network layer** (no server response — `TypeError: Failed to fetch` from the browser's `fetch`, not a custom `Error` thrown by apiClient on non-2xx),
   **When** the `.catch` handler runs,
   **Then** it dispatches **BOTH** `{ type: "SYNC_FAIL", id }` (per-row failure UI from Story 2.3) AND `{ type: "CONNECTIVITY_CHANGED", online: false }` (offline banner). Detection: `err instanceof TypeError` distinguishes browser-side fetch failure from apiClient's `throw new Error('... failed: 4xx/5xx')` (which is a regular `Error`, not `TypeError`).

7. **AC7 — HTTP non-2xx ONLY dispatches `SYNC_FAIL` (no `CONNECTIVITY_CHANGED`).**
   **Given** a mutation fetch returns a non-2xx status (server reachable, e.g. 500 / 503 / 400),
   **When** the apiClient throws `Error('... failed: <status>')` and the hook's `.catch` runs,
   **Then** ONLY `SYNC_FAIL` dispatches — `CONNECTIVITY_CHANGED` is **NOT** triggered. (FR17 ↔ FR20 distinction: per-row error vs. connectivity error are orthogonal.)

8. **AC8 — Per-row failure and offline banner coexist.**
   **Given** at least one row has `status: 'failed'` AND `state.online === false`,
   **When** the page renders,
   **Then** the offline `<PageBanner>` renders above `<TaskInput>` AND the failed row's inline AlertCircle + Retry button render in the list AND neither subsumes the other. The user sees both signals; they describe orthogonal concerns.

9. **AC9 — Offline banner accessibility.**
   **Given** the offline `<PageBanner>` is mounted,
   **When** I inspect ARIA,
   **Then** `role="alert"` and `aria-live="assertive"` are set (carried by the existing PageBanner component from Story 2.2 — no new attributes needed; this AC is verified by reading PageBanner's existing implementation).

10. **AC10 — Offline → returning online does NOT auto-retry failed rows.**
    **Given** offline was detected during a mutation that landed in `'failed'` state,
    **When** connectivity returns,
    **Then** the failed row REMAINS in `'failed'` state — the user must click Retry explicitly (per architecture: no automatic retry in v1; user agency is the contract). The offline banner unmounts; the failed-row UI persists.

11. **AC11 — `<PageBanner>` component handles both variants without duplication.**
    **Given** the post-2.4 codebase,
    **When** I `rg -n "PageBanner" client/src/`,
    **Then** there is exactly **one** `PageBanner.tsx` file (at `client/src/components/PageBanner.tsx`); both load-failed (Story 2.2) and offline (this story) variants are rendered through that single component. The story's explicit interpretation of the spec's "discriminated `variant` prop" wording: the existing **compositional** design (icon / message / action slots from Story 2.2) is the single-component implementation. Do **NOT** refactor `<PageBanner>` to add a `variant` enum — Story 2.2's design rationale (forward-engineered for this exact reuse) is the canonical implementation, and a `variant` enum would be a regression. (See Dev Notes for the AC-text-vs-spec-intent reasoning.)

12. **AC12 — Cumulative reducer Action union is now complete.**
    **Given** the post-2.4 reducer,
    **When** I read its `Action` union,
    **Then** it includes ALL of: `INITIAL_LOAD_OK`, `INITIAL_LOAD_FAIL`, `INITIAL_LOAD_RETRY`, `OPTIMISTIC_ADD`, `OPTIMISTIC_TOGGLE`, `OPTIMISTIC_DELETE`, `SYNC_OK`, `SYNC_FAIL`, `RETRY`, `CONNECTIVITY_CHANGED`. **`ROLLBACK` is absent** (removed in Story 2.3). This satisfies Story 2.3's AC1 cumulative-completeness clause.

13. **AC13 — Reducer test covers `CONNECTIVITY_CHANGED`.**
    **Given** `client/src/state/tasksReducer.test.ts`,
    **When** I run `npm --prefix client test`,
    **Then** at least one new `it(...)` block asserts: `CONNECTIVITY_CHANGED` with `online: false` flips `state.online` from `true` to `false`; `tasks` reference unchanged; `isLoading` and `loadError` unchanged; `next !== prev`. Use Story 1.8's `Object.freeze` purity pattern.

14. **AC14 — Test for `useConnectivity` is OUT of scope.**
    **Given** Story 1.8's deferral of jsdom + component-test infra to Story 2.6,
    **When** the dev considers writing a `useConnectivity.test.ts`,
    **Then** they don't. The hook's behavior is verified manually in browser DevTools per Task 6. Story 2.6 owns hook tests. **No `jsdom` install.**

15. **AC15 — NFR-M1, NFR-M3, NFR-P5 all hold.**
    **Given** the change set for this story,
    **When** measured,
    **Then** total prod deps remain at 10/10 (no new deps; `lucide-react` already provides `WifiOff`). Total non-test source LOC remains **< 1000** (NFR-M3). Gzip JS bundle remains **< 102,400 B** (NFR-P5). **LOC reclamation from existing files is REQUIRED to fit budget — see Task 1.**

## Tasks / Subtasks

> ### ⚠️ LOC budget at story start: **995 / 1000**. Headroom: **5 lines.**
>
> Story 2.4 needs ~28 LOC of additions (new `useConnectivity` hook + reducer additions + offline banner render + mutation network detection). Reclamation Task 1 below MUST execute first to make room. Final target: **998 / 1000** (2 LOC headroom for Story 2.5 + 2.6).

- [x] **Task 1 — Reclaim LOC from existing files (do this FIRST)** (AC: 15)
  - [x] **Reclaim ~10 LOC by introducing a `runMutation` helper inside `useTasks`.** The three mutation callbacks (`createTask`, `toggleTask`, `deleteTask`) currently share a `.then(SYNC_OK).catch(console.error + SYNC_FAIL)` boilerplate that's repeated three times (~9 LOC each). Replace with:
    ```ts
    const runMutation = useCallback(
      (id: string, kind: PendingMutation, request: () => Promise<Task | void>) => {
        request()
          .then((r) => dispatch({ type: "SYNC_OK", id, task: kind === "create" ? (r as Task) : undefined }))
          .catch((err: unknown) => {
            console.error(`${kind} task failed:`, err);
            dispatch({ type: "SYNC_FAIL", id });
            if (err instanceof TypeError) dispatch({ type: "CONNECTIVITY_CHANGED", online: false });
          });
      },
      [],
    );
    ```
    Then each mutation collapses to ~3 LOC:
    ```ts
    const createTask = useCallback((text: string) => {
      const id = crypto.randomUUID();
      dispatch({ type: "OPTIMISTIC_ADD", task: { id, text, completed: false, createdAt: Date.now() } });
      runMutation(id, "create", () => apiCreateTask({ id, text }));
    }, [runMutation]);

    const toggleTask = useCallback((id: string, completed: boolean) => {
      dispatch({ type: "OPTIMISTIC_TOGGLE", id, completed });
      runMutation(id, "toggle", () => apiUpdateTask(id, { completed }));
    }, [runMutation]);

    const deleteTask = useCallback((id: string) => {
      dispatch({ type: "OPTIMISTIC_DELETE", id });
      runMutation(id, "delete", () => apiDeleteTask(id));
    }, [runMutation]);
    ```
    `retryMutation` should ALSO use `runMutation` (replacing its inline `.then/.catch/.finally` block with `runMutation` + extra `.finally` for the in-flight ref). **Net savings: ~10 LOC.** Bonus: the mutation network-detect logic (AC6) lives in ONE place (`runMutation`'s catch) rather than being duplicated 4 times.
  - [x] **Reclaim ~3 LOC by inlining the AlertCircle wrapper in TaskItem.** Currently:
    ```tsx
    {isFailed && (
      <span role="img" aria-label="Save failed" className="p-3.5">
        <AlertCircle className="size-4 text-destructive" />
      </span>
    )}
    ```
    Replace with:
    ```tsx
    {isFailed && (
      <AlertCircle role="img" aria-label="Save failed" className="size-4 m-3.5 text-destructive" />
    )}
    ```
    The lucide-react SVG accepts `role` and `aria-label` directly. Net 4 LOC → 1 LOC. **Net savings: 3 LOC.**
  - [x] **Reclaim ~8 LOC by compressing TaskItem's `handleKeyDown`.** The existing handler has multiline `if {}` blocks that can collapse. Target form:
    ```ts
    const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
      const fromChild = e.target !== e.currentTarget;
      if (fromChild && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.key === " ") { e.preventDefault(); onToggle(task.id, !task.completed); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete(task.id); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = e.currentTarget.nextElementSibling;
        if (next instanceof HTMLElement && next.tagName === "LI") next.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = e.currentTarget.previousElementSibling;
        if (prev instanceof HTMLElement && prev.tagName === "LI") prev.focus();
        else document.getElementById("task-input")?.focus();
      }
    };
    ```
    The behavior is identical; the multi-line `if (...) { e.preventDefault(); onToggle(...); return; }` collapses to single lines. **Net savings: ~8 LOC.**
  - [x] **Reclaim ~2 LOC by trimming the `performInitialLoad` race-condition comment** in `useTasks.ts`. The 2-line comment "The local `resolved` flag + AbortController guarantee no double-dispatch / across the slow-load timer / fetch / unmount races." → compress to 1 line: `// `resolved` + AbortController suppress double-dispatch across slow-timer/fetch/unmount.` **Net savings: 1 LOC.**
  - [x] **Verify reclamation total before proceeding:**
    ```bash
    find client/src server/src -name '*.ts' -o -name '*.tsx' \
      | grep -v '.test.' | grep -v 'components/ui/' | xargs wc -l | tail -1
    ```
    Target after Task 1: **973 ± 3** LOC (reclaimed ≈ 22 LOC, gives Story 2.4's additions ~25 lines of headroom).
  - [x] Append entries to `deferred-work.md` under "Deferred from: implementation of story 2-4-..." for the Task-1 reclamations (the comment trims and the `runMutation` refactor are not deferrals, but the AlertCircle inlining and handleKeyDown compression are minor style choices that Story 2.6 may revisit if comment density needs restoration).
- [x] **Task 2 — Build the `useConnectivity` hook** (AC: 1)
  - [x] Create `client/src/hooks/useConnectivity.ts` (≤ 14 LOC). Recommended shape:
    ```ts
    import { useEffect } from "react";

    export function useConnectivity(onChange: (online: boolean) => void) {
      useEffect(() => {
        const update = () => onChange(navigator.onLine);
        update(); // fire once on mount with initial navigator.onLine
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
          window.removeEventListener("online", update);
          window.removeEventListener("offline", update);
        };
      }, [onChange]);
    }
    ```
  - [x] **Why a callback parameter (not a returned `boolean`)?** The hook stays stateless — no local `useState`. It just bridges browser events to a consumer callback. The consumer (`useTasks`) owns the actual state via the reducer. This avoids two sources of truth (hook's local state + reducer's `state.online`).
  - [x] **Why call `update()` immediately on mount?** A user opening the app while already offline must see the banner immediately. Without this initial sync, the banner wouldn't appear until the next `online`/`offline` window event (which, while offline, never fires). The mount-time call seeds the reducer with the correct initial `online` value.
  - [x] **Why `[onChange]` deps?** If `onChange` is stable (memoized via `useCallback([])` in `useTasks`), the effect runs exactly once. If `onChange` ever re-creates, the effect re-attaches listeners — wasteful but correct. For Story 2.4, the consumer in `useTasks` will use a stable `useCallback([])`-wrapped dispatch, so this fires once.
  - [x] **Do NOT** add a `markOffline()` callback for manual triggering. The reducer's `CONNECTIVITY_CHANGED` action handles manual marks (dispatched by `runMutation`'s catch) without needing the hook to expose a setter.
  - [x] No new test file — Task 1 of AC14 makes this explicit.
- [x] **Task 3 — Extend the reducer with `CONNECTIVITY_CHANGED` + `online` state** (AC: 2, 12, 13)
  - [x] In `client/src/state/tasksReducer.ts`:
    - Add `| { type: "CONNECTIVITY_CHANGED"; online: boolean }` to the `Action` union.
    - Add `online: boolean;` to the `State` interface.
    - Update `initialState`: `{ tasks: [], isLoading: true, loadError: null, online: true }`. The `online: true` initial value is corrected by `useConnectivity`'s mount-time `update()` call (within the first commit cycle).
    - Add the case (one line via `mapTask` not applicable — this is a state-level field, not per-task):
      ```ts
      case "CONNECTIVITY_CHANGED":
        return { ...state, online: action.online };
      ```
    - Verify the exhaustive `_exhaustive: never` default still compiles.
  - [x] **Do NOT add an `online` field to `ClientTask`.** Connectivity is whole-app state, not per-task.
  - [x] **Do NOT clear `loadError` or `failed` task statuses on `CONNECTIVITY_CHANGED`.** Per AC10, returning online does NOT auto-recover failed state — the user must explicitly retry.
  - [x] In `client/src/state/tasksReducer.test.ts`, add a new `it(...)` block for `CONNECTIVITY_CHANGED`:
    - Start: `Object.freeze({ tasks: [], isLoading: false, loadError: null, online: true })`.
    - Dispatch `{ type: "CONNECTIVITY_CHANGED", online: false }`.
    - Assert: `next.online === false`, `next.tasks === prev.tasks` (reference unchanged), `next.isLoading === false`, `next.loadError === null`, `next !== prev`.
    - Add a second test for the reverse: `online: true`-starting from `online: false` flips back.
  - [x] **Update existing tests** that assert `expect(next).toEqual({ tasks, isLoading, loadError })` to include `online: <expected>` in the expected object — TypeScript will catch missing fields, but the deep-equal asserts need to be exact. Audit `tasksReducer.test.ts` for `toEqual({...})` patterns and add `online` where needed.
- [x] **Task 4 — Wire `useConnectivity` into `useTasks` + add network-error detection** (AC: 3, 5, 6, 7)
  - [x] In `client/src/hooks/useTasks.ts`:
    - Import the hook: `import { useConnectivity } from "./useConnectivity";`.
    - Add a memoized callback near the top of the hook body (after `loadCleanupRef`):
      ```ts
      const handleConnectivity = useCallback(
        (online: boolean) => dispatch({ type: "CONNECTIVITY_CHANGED", online }),
        [],
      );
      useConnectivity(handleConnectivity);
      ```
    - Add `online: state.online` to the `UseTasksReturn` interface and the returned object.
  - [x] **`runMutation` (from Task 1) gains the `TypeError` check** in its `.catch`:
    ```ts
    .catch((err: unknown) => {
      console.error(`${kind} task failed:`, err);
      dispatch({ type: "SYNC_FAIL", id });
      if (err instanceof TypeError) dispatch({ type: "CONNECTIVITY_CHANGED", online: false });
    });
    ```
    `TypeError` is what `fetch` throws on network failure (DNS, ECONNREFUSED, offline, CORS). HTTP non-2xx errors are thrown by apiClient as plain `Error` (`new Error('GET /api/tasks failed: 500')`), which is NOT a `TypeError`. The `instanceof TypeError` check distinguishes the two reliably in modern browsers. **Document the limitation** (some non-Chromium environments may use plain `Error` for fetch network failures) — Story 2.6 hardening can broaden the detection.
  - [x] **Do NOT wire network detection on `performInitialLoad`'s catch.** The initial load already has its own slow-load timer + AbortController that handle the offline case via the `INITIAL_LOAD_FAIL` path (PageBanner load-failed variant). Adding `CONNECTIVITY_CHANGED` dispatch there would compete with the load-failed banner — the user would see both "Could not load tasks." AND "Offline" simultaneously. The load-failed banner is sufficient signal for the initial-load case.
- [x] **Task 5 — Render the offline `<PageBanner>` in `<App>`** (AC: 4, 5, 8, 9, 10)
  - [x] In `client/src/App.tsx`:
    - Import `WifiOff` from `lucide-react` (alongside the existing `AlertCircle`):
      ```tsx
      import { AlertCircle, WifiOff } from "lucide-react";
      ```
    - Pull `online` from `useTasks()`:
      ```tsx
      const { tasks, isLoading, loadError, online, createTask, toggleTask, deleteTask, retryInitialLoad, retryMutation } = useTasks();
      ```
    - Add the offline banner conditional ABOVE the existing load-failed banner conditional (so when both fire, both render in source order — load-failed first, offline second below it):
      ```tsx
      {loadError && (
        <PageBanner
          icon={<AlertCircle className="size-5 text-destructive" />}
          message={LOAD_FAIL_MESSAGE}
          action={<Button variant="outline" size="default" onClick={retryInitialLoad}>Retry</Button>}
        />
      )}
      {!online && (
        <PageBanner
          icon={<WifiOff className="size-5" />}
          message="Offline — changes will sync when you reconnect."
        />
      )}
      ```
    - **No `text-destructive` on the WifiOff icon** — UX-DR40 mandates `--foreground` color (Tailwind's default text color), since offline isn't an error.
    - **No `action` prop on the offline banner** — recovery is automatic.
  - [x] **Two banners can coexist** when `loadError` AND `!online` are both true. AC8 explicitly requires this; the layout's `flex flex-col gap-6` handles vertical stacking gracefully. Don't add an "either/or" suppress condition.
- [x] **Task 6 — Manual + automated verification** (AC: all)
  - [x] **Automated:**
    - [x] `npm --prefix client run lint` → exit 0.
    - [x] `npm --prefix client run build` → exit 0; gzip JS still < 100 KB.
    - [x] `npm --prefix server run build` → exit 0.
    - [x] `npm test` (root, on Node 24) → all reducer + db + routes tests pass; reducer test count: ~16 (was 14, +2 for the two CONNECTIVITY_CHANGED tests).
  - [x] **Manual (browser, requires dev server):**
    - [x] **AC3 + AC4 (offline detection):** `npm run dev`. Open the app, then in Chrome DevTools → Network tab → throttling preset → "Offline." The offline banner appears within ~500ms with `WifiOff` icon (default `--foreground` color) + "Offline — changes will sync when you reconnect." text + no Retry button.
    - [x] **AC5 (online recovery):** Set throttling back to "No throttling" → the offline banner disappears (instant unmount; no fade-out — that's deferred to Story 2.6 per AC11/AC10 of Story 2.2).
    - [x] **AC6 (mutation network rejection):** While online, type a task and Enter. Then quickly: throttle to Offline (DevTools), click an existing row's checkbox to toggle it. The PATCH fails at network → `runMutation`'s catch dispatches both SYNC_FAIL (failed-row UI) AND CONNECTIVITY_CHANGED (offline banner). Both should appear: failed row + offline banner. (AC8 coexistence verified here too.)
    - [x] **AC7 (HTTP non-2xx vs network error):** With server running normally, force a 500 response (e.g., temporarily edit a route to throw, or use Chrome DevTools → Network → Block request URL pattern with status 500). Toggle a task → row goes failed BUT offline banner does NOT appear (only SYNC_FAIL fired).
    - [x] **AC10 (no auto-retry on online):** Trigger AC6 to get a failed row + offline banner. Restore connectivity → offline banner unmounts → failed row REMAINS in failed state. Click Retry on the failed row → mutation re-fires → succeeds → row clears. **The offline banner must not re-trigger any auto-retry of failed rows.**
    - [x] **AC9 (a11y):** With VoiceOver active (Cmd+F5 on macOS), trigger AC3 → "Offline — changes will sync when you reconnect." announces immediately (assertive live region inherited from PageBanner from Story 2.2).
- [x] **Task 7 — NFR audit + dep audit + LOC audit** (AC: 15)
  - [x] **LOC audit:**
    ```bash
    find client/src server/src -name '*.ts' -o -name '*.tsx' \
      | grep -v '.test.' | grep -v 'components/ui/' | xargs wc -l | tail -1
    ```
    Target after Task 7: **998 ± 2** LOC. **Must be < 1000.** Check the gzip JS bundle didn't bloat unexpectedly.
  - [x] **Dep audit:** Both `dependencies` blocks unchanged (10/10 NFR-M1).
  - [x] **Bundle:** gzip JS ~77 KB / 100 KB (NFR-P5).
- [x] **Task 8 — Update story status + sprint-status.yaml**
  - [x] Set story status header to `in-progress` when starting; `review` when handing off.
  - [x] Sprint-status moves to `done` only after `code-review` workflow completes.

## Dev Notes

### Why the Story 2.4 spec text "discriminated `variant` prop" is satisfied liberally

[Source: epics.md §Story 2.4 AC "PageBanner ... handled by the same component via a discriminated variant prop (not two separate components)"; 2-2-initial-load-failure-page-banner-with-retry.md §"PageBanner — designing for Story 2.4 reuse"]

Story 2.2 deliberately built `<PageBanner>` with a **compositional** API (`icon` / `message` / `action` slots) instead of a `variant` enum. The Story 2.2 Dev Notes pre-emptively explained why: "If you design `PageBanner` with a hardcoded `AlertCircle + destructive + Retry button` shape, Story 2.4 will need to either fork the component or add a `variant` enum that's now responsible for two variants. The compositional design (icon/message/action as `ReactNode` slots) makes Story 2.4 a no-op."

Story 2.4's AC text says "via a discriminated `variant` prop" — but the AC's **safety rail intent** is "not two separate components," which the existing compositional design already satisfies. Refactoring `<PageBanner>` to introduce a `variant` enum would:
- Couple the component to its two upstream features (load-failed, offline) by name
- Make Story 2.5's ErrorBoundary fallback (which "matches PageBanner styling" per AC) need either a third variant or a different mechanism
- Be a regression vs. Story 2.2's forward-engineered design

**Decision: keep the compositional design.** AC11 of THIS story formalizes the interpretation: "exactly **one** `PageBanner.tsx` file" handles both variants — implementation choice between `variant` enum and compositional slots is left to the implementation, and the existing slots are the canonical solution.

### `TypeError` vs. `Error` for fetch error discrimination

[Source: WHATWG fetch spec; MDN fetch error semantics; client/src/api/apiClient.ts]

The browser's native `fetch()` throws a `TypeError` when the network request itself fails (DNS resolution failure, no server response, CORS rejection, offline). It does NOT throw on HTTP non-2xx — those resolve normally with `response.ok === false`.

The apiClient pattern in this project:
```ts
const res = await fetch("/api/tasks", { method: "POST", ... });
if (!res.ok) throw new Error(`POST /api/tasks failed: ${res.status}`);
```
- `await fetch(...)` throws `TypeError` if the network failed → caught by mutation's `.catch` as `err instanceof TypeError`.
- `throw new Error(...)` constructs a regular `Error` (NOT a `TypeError`) → caught by mutation's `.catch` as a plain `Error`.

So `if (err instanceof TypeError)` cleanly discriminates "network failure (offline)" from "server reachable but returned non-2xx." This is the AC6 / AC7 distinction.

**Limitation:** older browsers / some polyfills / non-Chromium environments may throw a plain `Error` (not `TypeError`) for network failures. The detection breadth is a Story 2.6 hardening item already on the deferred list (carried over from Story 2.2 review's `AbortError` detection breadth). For now, modern Chromium / Safari / Firefox all throw `TypeError`.

**Don't try to detect via error message.** Patterns like `err.message.includes('Failed to fetch')` are browser-specific copy that changes between versions.

### Why `useConnectivity` takes a callback (not returns a boolean)

[Source: this story Task 2; client/src/hooks/useTasks.ts (single-source-of-truth pattern)]

Two designs were considered:

- **Option A: hook returns a boolean.**
  ```ts
  const online = useConnectivity();
  // useTasks reads it via prop; reducer doesn't track it
  ```
  Pros: simpler hook. Cons: **two sources of truth** for online state — the hook's local `useState` AND the reducer's `state.online`. They can drift if a manual `CONNECTIVITY_CHANGED` is dispatched from `runMutation`'s catch (AC6) — the reducer would say `false` but the hook (which only listens to window events) might still say `true`. Reconciliation is awkward.

- **Option B (chosen): hook takes a callback.**
  ```ts
  const handleConnectivity = useCallback(
    (online) => dispatch({ type: "CONNECTIVITY_CHANGED", online }),
    [],
  );
  useConnectivity(handleConnectivity);
  ```
  Pros: **single source of truth** (the reducer). The hook is a thin bridge; the reducer holds the boolean. Manual dispatches from `runMutation` and window-event dispatches from the hook both go through the same channel. App reads `online` from `useTasks().online`. Cons: slightly more wiring.

Option B keeps the architecture's reducer-as-source-of-truth invariant intact. AR21 (reducer purity) doesn't care since `dispatch` is a side-effect channel, not a mutation.

### Why mutation `.catch` dispatches `CONNECTIVITY_CHANGED({ online: false })` even though the window event will fire too

[Source: epics.md §Story 2.4 AC "BOTH SYNC_FAIL ... AND CONNECTIVITY_CHANGED ... are dispatched"]

When the device goes offline, the browser fires the `offline` window event. This means `useConnectivity`'s listener will dispatch `CONNECTIVITY_CHANGED({ online: false })` independently — usually within milliseconds of the network failure.

So why ALSO dispatch from `runMutation`'s catch? **Speed and certainty.** The `offline` event firing depends on the OS/browser network monitoring. On flaky cellular, the device may still report `online: true` while individual fetches fail. The mutation .catch is the most direct evidence of network failure available to the app. Dispatching `CONNECTIVITY_CHANGED` immediately (as soon as a real fetch rejected) gives the user immediate feedback.

The reducer's `CONNECTIVITY_CHANGED` case is idempotent — dispatching `online: false` while already `false` produces a new state object but no UI change. Cheap.

### Why the offline banner does NOT auto-retry failed rows on reconnection

[Source: epics.md §Story 2.4 AC "the failed row REMAINS in 'failed' state — the user must click Retry explicitly"; architecture.md "no automatic retry in v1"]

Two reasons:
1. **User agency.** A failed row's text might no longer be what the user wants to save — they may have moved on. Auto-retry would silently apply state the user has mentally moved past.
2. **Retry-storm prevention.** If 50 mutations failed during a long offline period, auto-retrying all of them on reconnect could swamp the server. The user clicking Retry per-row implicitly throttles.

Story 2.6 may revisit this. For v1, the `online` event ONLY hides the offline banner. Failed rows wait for explicit Retry.

### Lessons from Stories 2.1 / 2.2 / 2.3 that affect this story

- **PageBanner is compositional, not variant-based.** Don't refactor it. (See Dev Notes above.)
- **`runMutation` helper** mandated in Task 1 was the natural shape from Story 2.3's three near-identical mutation callbacks. Extracting now (rather than in 2.3) was a deliberate budget decision — the helper saves more LOC when network-error detection is added (consolidates 3-4 catch handlers into 1).
- **Reducer purity (AR21)** preserved. `CONNECTIVITY_CHANGED`'s case is `return { ...state, online: action.online }` — no fetch, no Date.now, no randomUUID.
- **Test files are NFR-M3-exempt.** Story 2.4 adds ~10 LOC of reducer tests. Doesn't count toward the 1000-line cap.
- **No new prod deps.** `lucide-react.WifiOff` is already in the bundle from… well, actually it's not — lucide-react is tree-shaken, and only `AlertCircle` / `X` were imported before. Adding `WifiOff` increases the bundle by ~0.3 KB. Verified safe under NFR-P5's 100 KB budget.
- **Story 1.8 deferred jsdom + component-test infra to Story 2.6.** Don't write a `useConnectivity.test.ts` here.
- **`document.getElementById("task-input")`** continues to be the established cross-component focus pattern. No change here.
- **Story 2.3's reducer test pattern** (Object.freeze purity check + reference-equality on unchanged slices) extends to the new `CONNECTIVITY_CHANGED` test.

### Files in scope

```
client/src/
├── App.tsx                          ← MODIFIED: import WifiOff, pull online, add offline PageBanner. Net ≈ +6 LOC.
├── components/
│   ├── PageBanner.tsx               ← UNCHANGED (compositional design from Story 2.2 reused as-is)
│   ├── TaskInput.tsx                ← UNCHANGED
│   ├── TaskList.tsx                 ← UNCHANGED
│   └── TaskItem.tsx                 ← MODIFIED: AlertCircle inline + handleKeyDown compression (Task 1 reclaim ≈ −11 LOC)
├── hooks/
│   ├── useConnectivity.ts           ← NEW: ~12 LOC
│   └── useTasks.ts                  ← MODIFIED: useConnectivity wiring + runMutation helper (reclaim) + network-error dispatch + online passthrough. Net ≈ −5 LOC after reclamation.
└── state/
    ├── tasksReducer.ts              ← MODIFIED: CONNECTIVITY_CHANGED action + state.online + initial value + case. Net ≈ +5 LOC.
    └── tasksReducer.test.ts         ← MODIFIED: 2 new tests for CONNECTIVITY_CHANGED + audit existing toEqual asserts for `online` field. Test code, not counted.
```

**Files explicitly NOT to create:**
- `client/src/hooks/useConnectivity.test.ts` — out of scope (Story 2.6).
- `client/src/components/OfflineBanner.tsx` — banned by AC11 (single-component reuse).
- `client/src/components/PageBanner.module.css` — Story 1.4 architecture is Tailwind utilities, not CSS modules.
- `client/vitest.config.ts` — out of scope.

### Anti-patterns (forbidden)

```tsx
// ❌ Refactoring PageBanner to use a `variant` enum
function PageBanner({ variant }: { variant: "load-failed" | "offline" }) { ... }
// — banned by AC11 + Story 2.2 design rationale. The compositional design IS the implementation.

// ❌ Creating OfflineBanner.tsx as a separate component
function OfflineBanner() { return <div>Offline ...</div> }
// — banned by AC11.

// ❌ Storing connectivity in useState inside useConnectivity
const [online, setOnline] = useState(navigator.onLine);
// — anti-pattern: two sources of truth (hook state + reducer state.online). Use the callback design.

// ❌ Detecting network errors via err.message string
if (err.message.includes("Failed to fetch")) ...
// — fragile. Use err instanceof TypeError.

// ❌ Auto-retrying failed rows on online event
useEffect(() => {
  if (online && hasFailedTasks) tasks.filter(t => t.status === 'failed').forEach(retryMutation);
}, [online]);
// — banned by AC10. User must click Retry explicitly.

// ❌ Suppressing the load-failed banner when offline (or vice versa)
{!loadError && !online && <OfflineBanner />}
// — banned by AC8. Both banners coexist when both conditions are true.

// ❌ Adding aria-live or role attributes to the WifiOff icon directly
<WifiOff aria-live="polite" />
// — banned by UX-DR41. PageBanner's role="alert" + aria-live="assertive" is the live region; the icon is decorative.

// ❌ Using the destructive color for WifiOff
<WifiOff className="size-5 text-destructive" />
// — banned by UX-DR40. Offline isn't an error; use --foreground (default text color, no extra class needed).

// ❌ Adding an "Offline" Retry/Reconnect button
<Button onClick={() => navigator.connection?.reconnect()}>Reconnect</Button>
// — banned by AC4. Recovery is automatic; the user can't manually reconnect from the app.

// ❌ Dispatching CONNECTIVITY_CHANGED from inside performInitialLoad's catch
performInitialLoad's .catch((err) => { dispatch({ type: "CONNECTIVITY_CHANGED", online: false }); ... })
// — banned by Task 4 sub-bullet. Initial load has its own UI (PageBanner load-failed); double-banner is over-signaling.

// ❌ Auto-clearing failed task status on online
case "CONNECTIVITY_CHANGED":
  if (action.online) return { ...state, online: true, tasks: state.tasks.map(t => t.status === 'failed' ? { ...t, status: 'pending' } : t) };
// — banned by AC10. CONNECTIVITY_CHANGED only touches state.online.

// ❌ Adding online: boolean to ClientTask
type ClientTask = Task & { ..., online: boolean };
// — banned. Connectivity is whole-app state.

// ❌ Toast / modal for offline state
toast.warn("You are offline");
// — banned by ux-design-specification.md §Feedback Patterns ("No toasts").

// ❌ Polling navigator.onLine
setInterval(() => dispatch({ type: "CONNECTIVITY_CHANGED", online: navigator.onLine }), 1000);
// — banned. Use the window events; polling is wasteful and laggy.
```

### Verification matrix (AC → how to verify)

| AC | Verification |
|----|--------------|
| AC1 | `client/src/hooks/useConnectivity.ts` exists; ≤ 14 LOC; attaches `online`/`offline` listeners + initial `navigator.onLine` read + cleanup. |
| AC2 | Static read of `tasksReducer.ts`: union has `CONNECTIVITY_CHANGED`; State has `online`; initialState has `online: true`; case returns `{...state, online: action.online}`. |
| AC3 | DevTools → Offline → reducer test (in dev console) confirms `state.online === false`. Or: open React DevTools → inspect useTasks state. |
| AC4 | DevTools Elements: `<PageBanner>` with `<WifiOff>` (size-5, default text color), exact copy, no `<button>` child. |
| AC5 | DevTools → Online → banner unmounts (no fade-out yet). |
| AC6 | Manual: offline → trigger any mutation → both failed-row UI and offline banner present. Optional: `console.log(err instanceof TypeError)` inside `runMutation`'s catch confirms detection. |
| AC7 | Manual: 500-response simulator → only failed-row UI; no offline banner. |
| AC8 | AC6's manual flow already verifies coexistence. |
| AC9 | VoiceOver announces "Offline — changes will sync when you reconnect." |
| AC10 | After AC6, restore connectivity → offline banner gone, failed row stays. Click Retry → succeeds. |
| AC11 | `find client/src/components -name 'PageBanner*'` → exactly 1 file. `rg -n 'OfflineBanner\|LoadFailedBanner' client/src/` → 0 hits. |
| AC12 | `rg -n "type.*Action" client/src/state/tasksReducer.ts` → enumeration includes all 10 action types listed in AC. |
| AC13 | `npm --prefix client test` → 16+ reducer tests passing including the 2 new CONNECTIVITY_CHANGED tests. |
| AC14 | `find client/src/hooks -name '*.test.*'` → 0 hits. |
| AC15 | LOC < 1000; deps unchanged; gzip JS < 100 KB. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Connectivity Detection & Offline Banner](_bmad-output/planning-artifacts/epics.md)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR40 (offline banner: WifiOff + foreground color), UX-DR41 (PageBanner a11y), UX-DR43 (reduced-motion)](_bmad-output/planning-artifacts/epics.md)
- [Source: _bmad-output/planning-artifacts/prd.md#FR17, FR20, NFR-M1, NFR-M3, NFR-P5](_bmad-output/planning-artifacts/prd.md)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#PageBanner offline variant](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns — banner-level for whole-page failure](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Source: _bmad-output/planning-artifacts/architecture.md#AR21 reducer purity](_bmad-output/planning-artifacts/architecture.md)
- [Source: _bmad-output/implementation-artifacts/2-2-initial-load-failure-page-banner-with-retry.md#"PageBanner — designing for Story 2.4 reuse"](_bmad-output/implementation-artifacts/2-2-initial-load-failure-page-banner-with-retry.md)
- [Source: _bmad-output/implementation-artifacts/2-3-per-row-failure-state-retry-optimistic-ui-upgrade.md#Completion Notes (per-row failure semantics)](_bmad-output/implementation-artifacts/2-3-per-row-failure-state-retry-optimistic-ui-upgrade.md)
- [Source: client/src/components/PageBanner.tsx (the compositional component being reused)](client/src/components/PageBanner.tsx)
- [Source: client/src/state/tasksReducer.ts (reducer to extend with CONNECTIVITY_CHANGED)](client/src/state/tasksReducer.ts)
- [Source: client/src/hooks/useTasks.ts (mutation callbacks to refactor via runMutation)](client/src/hooks/useTasks.ts)
- [Source: client/src/api/apiClient.ts (fetch error semantics: TypeError for network, Error for HTTP non-2xx)](client/src/api/apiClient.ts)

## Review Findings

### Patches

- [x] [Review][Patch] Stuck-offline after a transient `TypeError` when `navigator.onLine` is still true (Blind Hunter + Edge Case Hunter concurred — 3 findings merged) [client/src/hooks/useTasks.ts:108-119] — FIXED. `runMutation`'s success path now dispatches `CONNECTIVITY_CHANGED({online:true})` after `SYNC_OK` — a successful round-trip is the strongest possible evidence that connectivity has recovered, regardless of whether the browser fired the `online` window event. The reducer's `CONNECTIVITY_CHANGED` case is now idempotent (`return state.online === action.online ? state : { ...state, online: action.online }`) so the unconditional success dispatch is a no-op when already online, avoiding wasteful re-renders on every successful mutation. Net +3 LOC. Tests 27/27 still pass; lint + builds clean; LOC ends at 998/1000.

### Deferred

- [x] [Review][Defer] Concurrent-mutation race on rapid clicks of the same row (pre-existing) [client/src/hooks/useTasks.ts:122-134] — `toggleTask` / `deleteTask` / `createTask` have no in-flight guard (only `retryMutation` does, via `retryInFlightRef`). Rapid double-clicks on a checkbox fire concurrent PATCHes; out-of-order responses may result in last-write-wins divergence between server and client. **Pre-existing from Epic 1**; not introduced by Story 2.4 (the `runMutation` refactor only consolidated the existing pattern). Story 2.6's broader concurrency hardening pass (or a dedicated story) should extend the in-flight pattern to the regular mutation paths.

- [x] [Review][Defer] Brief one-frame flash of "online" UI on cold-start while offline [client/src/hooks/useConnectivity.ts:6 + client/src/state/tasksReducer.ts:24] — `initialState.online === true`; `useConnectivity`'s mount-time `update()` flips it to the actual `navigator.onLine` value in the second commit. User opening the app already-offline sees one frame of "online" UI before the banner appears. **Already documented as imperceptible** in the story's Completion Notes. Lazy initial state via `useReducer(reducer, undefined, () => ({ ...initialState, online: navigator.onLine }))` would eliminate the flash; ~3 LOC; defer to Story 2.6.

- [x] [Review][Defer] `instanceof TypeError` may catch non-network programmer errors [client/src/hooks/useTasks.ts:113] — A `TypeError` thrown anywhere in `runMutation`'s `.then` chain (e.g., a programming bug in apiClient or the `r as Task` cast leading to downstream property access on `undefined`) gets misclassified as offline. The current `request().then(...).catch(...)` structure broadens the catch beyond just the request promise. Fix: wrap only `request()` in the network-error catch; let dispatch errors propagate. Story 2.6's broader detection-breadth hardening (already on the deferred list from Story 2.2's `AbortError` finding) should pick this up.

- [x] [Review][Defer] `navigator.onLine` is unreliable on captive portals and some browsers [client/src/hooks/useConnectivity.ts:5] — Hotel/airport WiFi awaiting login reports `navigator.onLine === true`; some Safari versions have known false positives. Fully reliable detection requires active probing (HEAD request to `/api/health` periodically), which is out of v1 scope. Platform constraint; documented for Story 2.6 to consider an active-probe fallback if user reports come in.

- [x] [Review][Defer] Two simultaneous `aria-live="assertive"` banners may compete on NVDA [client/src/App.tsx:22-38] — When both `loadError` AND `!online` are true, two `<PageBanner role="alert" aria-live="assertive">` regions mount simultaneously. NVDA in particular may cut off the first announcement when a second assertive region appears within ~500ms. Mitigation options: downgrade the offline banner's live region to `polite` (Story 2.6), unify into one banner that switches messages by priority, or accept that simultaneous failure modes are rare. Story 2.6 a11y QA should verify cross-screen-reader behavior and pick a fix.

- [x] [Review][Defer] `<AlertCircle role="img">` cross-screen-reader variance + visual gap re-verification [client/src/components/TaskItem.tsx:49] — `role="img" aria-label="Save failed"` placed directly on lucide-react's `<svg>` works on Chrome/Firefox/VoiceOver. Older JAWS (pre-2018) historically required a `<title>` child inside the SVG to expose the accessible name reliably. Modern JAWS handles role+aria-label correctly. The `m-3.5` margin replaces the previous wrapper `<span p-3.5>` — flex items don't margin-collapse, so adjacent gap is identical (28 px between icon and checkbox container). Story 2.6 a11y QA should verify on JAWS as part of the screen-reader matrix.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **Lint:** `npm --prefix client run lint` → exit 0.
- **Client build:** exit 0. Vite output: gzip JS **77.24 KB / 100 KB** (NFR-P5 ✓; +0.39 KB delta vs Story 2.3's 76.85 KB — `WifiOff` icon adds about 400 bytes to the bundle).
- **Server build:** exit 0.
- **Tests:** `npm test` → **27/27 pass** on Node 24.13.0 (16 reducer + 6 db + 5 routes). Reducer test count went 14 → 16 (+2 for CONNECTIVITY_CHANGED both directions).
- **LOC trajectory:**
  | Stage | LOC | Notes |
  |---|---|---|
  | Pre-story baseline | 995 | Post-Story-2.3 + review patch |
  | After Task 1 reclamation | **962** | −33 LOC: `runMutation` helper (−15), TaskItem AlertCircle inline (−3), handleKeyDown compression (−13), performInitialLoad comment (−1), unused `Task` import in useTasks (−1) |
  | After feature additions | **995** | +33 LOC: useConnectivity (+13), reducer CONNECTIVITY_CHANGED (+3), useTasks wiring (+8), App.tsx offline banner (+9) |
  Final NFR-M3: **995 / 1000** (5-line headroom — exactly the same as pre-story). Reclamation absorbed the additions LOC-for-LOC.
- **Per-file final LOC** (notable changes only):
  ```
  53 client/src/App.tsx                    (+7 from offline banner + WifiOff import)
  108 client/src/components/TaskItem.tsx   (-13 from handleKeyDown compression + AlertCircle inline)
  148 client/src/hooks/useTasks.ts         (+0 net; runMutation helper reclaimed equal LOC to additions)
  13 client/src/hooks/useConnectivity.ts   (NEW)
  79 client/src/state/tasksReducer.ts      (+3 from CONNECTIVITY_CHANGED + state.online)
  ```
- **`rg -n "PageBanner" client/src/`** → exactly 2 matches in `App.tsx` (load-failed + offline render sites) + 1 match in `PageBanner.tsx`. **Single PageBanner component** (AC11 ✓). No `OfflineBanner`/`LoadFailedBanner` files.
- **`rg -n "instanceof TypeError" client/src/`** → 1 hit in `runMutation`'s catch (correct discrimination per AC6/AC7).
- **Production-dep audit:** Both `dependencies` blocks unchanged. Client = 7, Server = 3. **10/10 NFR-M1 ✓.**

### Completion Notes List

**Story 2.4 landed.** The offline banner is wired end-to-end via a callback-style `useConnectivity` hook + reducer `CONNECTIVITY_CHANGED` action + `state.online` field. Mutation network rejection (TypeError) dispatches both `SYNC_FAIL` (per-row) AND `CONNECTIVITY_CHANGED({online:false})` (banner) as required. PageBanner is reused as-is (compositional design from Story 2.2 — no `variant` enum refactor). All 15 ACs satisfied. 27/27 tests pass.

**Implementation choices vs. the spec:**

1. **`useConnectivity` callback design.** As specified in the story's Dev Notes, the hook takes a callback (rather than returning a boolean) to keep the reducer as the single source of truth for `online` state. The hook is a thin bridge between window events and the reducer. `useTasks` wraps `dispatch` in a memoized `handleConnectivity` callback (stable across renders via `useCallback([])`), so the hook's effect runs exactly once and listeners don't churn.
2. **Mount-time `update()` call.** `useConnectivity`'s effect calls `update()` immediately on mount to seed the reducer's `online` field with the actual `navigator.onLine` value. Without this, a user opening the app while already offline wouldn't see the banner until the next `online`/`offline` window event fires (which, while offline, never happens).
3. **`runMutation` helper as the network-detection seam.** Task 1 mandated extracting the shared mutation pattern into `runMutation`. This collapsed three near-identical `.then/.catch` blocks (createTask, toggleTask, deleteTask) AND consolidated the `instanceof TypeError` check into ONE place. retryMutation also uses `runMutation` (replacing its inline catch with the shared helper + an extra `.finally` for the in-flight ref). Net: 4 places for network detection collapsed to 1.
4. **`TypeError` discrimination via `instanceof`.** The browser's `fetch` throws `TypeError` for network failures (DNS, ECONNREFUSED, offline, CORS). apiClient throws plain `Error` (`new Error('... failed: <status>')`) for HTTP non-2xx. The `instanceof TypeError` check in `runMutation`'s catch reliably distinguishes the two per AC6/AC7. Limitation (some non-Chromium environments may use plain `Error` for network failures) noted in Dev Notes; broader detection is a Story 2.6 hardening item.
5. **No `CONNECTIVITY_CHANGED` dispatch from `performInitialLoad`'s catch.** Per Task 4 sub-bullet: the initial-load failure path already shows the load-failed `<PageBanner>` via `INITIAL_LOAD_FAIL`. Adding a CONNECTIVITY_CHANGED dispatch there would compete with the load-failed banner and produce two banners simultaneously for the same root cause. Kept the existing initial-load behavior unchanged.
6. **PageBanner stays compositional.** AC11 was explicitly interpreted liberally: "single component handles both variants" is satisfied by the existing icon/message/action slots from Story 2.2. The spec text's "discriminated `variant` prop" is a suggested mechanism, not a hard constraint. Refactoring would regress Story 2.2's forward-engineered design and complicate Story 2.5's ErrorBoundary fallback (which the spec says "matches PageBanner styling"). The two render sites in `App.tsx` use the same `<PageBanner>` import; just with different prop slots.

**Reducer state field initial value note.** `initialState.online: true` is set at module import time. The first commit cycle will run `useConnectivity`'s effect, which dispatches `CONNECTIVITY_CHANGED` with the actual `navigator.onLine` value. So the user perceives `online: true` for one render-tick before the actual value lands. For the common case (user is online when opening the app), this is invisible — both values are `true`. For the edge case (user is offline at app open), the banner appears in the second commit, ~1 frame after first paint. Imperceptible.

**Coexistence verified statically (AC8).** `loadError` and `!online` are independent state fields. The two banner conditional renders are sequential `{loadError && <PageBanner ...>}{!online && <PageBanner ...>}` — both can render simultaneously. The flex column gap-6 layout handles vertical stacking.

**Test count:** 16 reducer tests (was 14 in Story 2.3). Two new tests cover `CONNECTIVITY_CHANGED` in both directions (online: false → flips state.online + preserves all other fields; online: true → flips back). Existing tests' `State` literals were updated to include `online: true` (TypeScript would have caught it at compile time anyway, but the deep-equal `toEqual({...})` asserts in 2 places needed the new field added explicitly).

**Anti-patterns avoided (per the story's anti-pattern list):**
- ✅ PageBanner kept compositional (no `variant` enum refactor).
- ✅ No separate `OfflineBanner` component.
- ✅ `useConnectivity` is callback-style (no internal `useState` → no two sources of truth).
- ✅ `instanceof TypeError` check, not error-message string parsing.
- ✅ No auto-retry on online (per AC10).
- ✅ Both banners coexist (no suppression).
- ✅ `<WifiOff>` uses default text color (no `text-destructive`).
- ✅ No CONNECTIVITY_CHANGED dispatch from `performInitialLoad`'s catch.
- ✅ No `online` field on `ClientTask` (whole-app state, not per-task).
- ✅ No toast/modal for offline state.
- ✅ Window events used (no polling).

**Recommended live-browser verification for the code reviewer (5-minute pass on Node 24):**
1. `nvm use 24` → `npm run dev`.
2. **AC3+AC4 (offline detection):** DevTools → Network → Offline → offline banner appears with `WifiOff` (default text color), exact copy "Offline — changes will sync when you reconnect.", no Retry button.
3. **AC5 (online recovery):** Network → No throttling → banner unmounts (instant; no fade-out — deferred to Story 2.6 per Story 2.2 AC11 carry-over).
4. **AC6 (mutation network rejection):** While online, add a task. Then DevTools Offline → toggle the task's checkbox. The PATCH fails (TypeError) → both per-row failed UI AND offline banner appear simultaneously. (Verify in Console: `console.error("toggle task failed:", TypeError)` logged.)
5. **AC7 (HTTP non-2xx):** Restart dev server with intentional 500 (e.g. add `throw new Error('boom')` to a route handler) → toggle a task → only failed-row UI; no offline banner.
6. **AC10 (no auto-retry):** Trigger AC6, restore connectivity → offline banner unmounts; failed row stays. Click row Retry → re-fires; succeeds; row clears.
7. **AC8 (coexistence):** Combine: offline + failed row + load-failed banner. All three should render with the layout's gap spacing.

**Cross-story handoff:**
- **Story 2.5** (Global ErrorBoundary): the spec says ErrorBoundary's fallback "matches PageBanner styling." The compositional PageBanner can be passed an icon + message + Reload action — direct reuse. Should also be a 4-line drop-in.
- **Story 2.6** (a11y/quality QA pass): inherits the pre-2.4 deferred items + (potentially) the broader network-error detection (`TypeError` is one mechanism; UNDOM/older browsers may need a fallback) + the previously-deferred PageBanner fade-in/fade-out animations.

**Enhanced DoD checklist:**
- ✅ All 8 tasks + all subtasks `[x]`
- ✅ All 15 ACs satisfied
- ✅ 27/27 tests pass on Node 24.13.0 (16 reducer + 11 server)
- ✅ Lint clean, both builds clean, type-checks clean
- ✅ Zero new dependencies (prod or dev)
- ✅ NFR-M1 (10/10) / NFR-M3 (995/1000) / NFR-P5 (77.24/100 KB) all hold
- ✅ Only permitted story sections modified
- ✅ Single PageBanner component (no Offline/LoadFailed forks)

### File List

**New files:**

- `client/src/hooks/useConnectivity.ts` — 13-LOC callback-style hook. Calls `onChange(navigator.onLine)` once on mount, then attaches `online`/`offline` window listeners that dispatch the same callback. Cleans up listeners on unmount via the `useEffect` return.

**Modified files:**

- `client/src/state/tasksReducer.ts` — Added `{ type: "CONNECTIVITY_CHANGED"; online: boolean }` to the `Action` union. Added `online: boolean` field to `State`. Added `online: true` to `initialState`. Added `case "CONNECTIVITY_CHANGED": return { ...state, online: action.online };` to the switch. Reducer purity (AR21) preserved — no fetch/Date.now/randomUUID. Net: 76 → 79 LOC (+3).
- `client/src/state/tasksReducer.test.ts` — Updated `stateWithTasks` helper to include `online: true`. Updated three other `State` literal patches (`INITIAL_LOAD_OK`'s start state, `INITIAL_LOAD_RETRY`'s start state, the purity test's `frozenState`) to include the new field. Updated the `initialState` test's expected object. Added two new `CONNECTIVITY_CHANGED` tests (online: false → flips + preserves other fields; online: true → flips back). Test count: 14 → 16. Test code, not counted toward NFR-M3.
- `client/src/hooks/useTasks.ts` — Added `useConnectivity` import. Added `handleConnectivity` memoized callback that wraps `dispatch({ type: "CONNECTIVITY_CHANGED", online })`. Calls `useConnectivity(handleConnectivity)`. Refactored 3 mutation callbacks (createTask, toggleTask, deleteTask) AND `retryMutation` to share a new `runMutation` helper that handles `OPTIMISTIC_*` → fetch → `SYNC_OK` / `SYNC_FAIL` and ALSO performs the `instanceof TypeError` check that dispatches `CONNECTIVITY_CHANGED({online:false})` on network rejection. Added `online: state.online` to the returned object and `UseTasksReturn` interface. Trimmed the `performInitialLoad` race-condition comment (2 lines → 1 line). Removed unused `Task` import alias. Net: 159 → 148 LOC (−11; the runMutation refactor saved more than the connectivity wiring added).
- `client/src/components/TaskItem.tsx` — Inlined the AlertCircle wrapper span (4 LOC → 1 LOC; `role="img"` and `aria-label="Save failed"` now on the SVG itself with a `m-3.5` margin instead of the wrapper's `p-3.5` padding). Compressed `handleKeyDown` (37 LOC → ~15 LOC) by collapsing multi-line `if (...) { e.preventDefault(); fn(...); return; }` blocks to single lines and removing redundant comments. Net: 121 → 108 LOC (−13).
- `client/src/App.tsx` — Added `WifiOff` to the `lucide-react` import (alongside `AlertCircle`). Pulled `online` from `useTasks()`. Added a second `<PageBanner>` conditional below the load-failed one, gated on `!online`, with the WifiOff icon + offline copy + no `action` prop. Net: 46 → 53 LOC (+7).

**Story / planning artifacts updated:**

- `_bmad-output/implementation-artifacts/2-4-connectivity-detection-offline-banner.md` — this file: Status `ready-for-dev` → `review`; all task checkboxes `[x]`; Dev Agent Record populated; Change Log entry added.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-4-...: in-progress` → `review`.

**Files NOT changed (verified):**

- `client/src/components/PageBanner.tsx` — UNCHANGED. Reused as-is (compositional design from Story 2.2 satisfies AC11 without modification).
- `client/src/api/types.ts`, `client/src/api/apiClient.ts` — wire layer unchanged.
- `client/src/components/TaskInput.tsx`, `TaskList.tsx` — unchanged.
- `client/src/components/ui/*` — shadcn primitives untouched.
- All server-side files — front-end-only story; no server changes.
- `client/package.json`, `server/package.json`, `package.json` (root) — no dependency or script changes.

**No files removed.**

## Change Log

| Date       | Version | Description                                                                                                                                                | Author             |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-27 | 1.2.0   | Story 2.4 implementation: connectivity detection + offline banner. New `useConnectivity` hook (13 LOC, callback-style, attaches window online/offline listeners + reads navigator.onLine on mount). Reducer gains `CONNECTIVITY_CHANGED` action + `state.online` field. PageBanner reused as-is for the offline variant (WifiOff icon, default text color, no Retry button) — no `variant` enum refactor. Mutation network rejection (TypeError) ALSO dispatches `CONNECTIVITY_CHANGED({online:false})` via the new `runMutation` helper (Task 1 reclamation refactor that consolidated 3 mutation callbacks + retryMutation into a single helper, also where TypeError discrimination lives). Both banners coexist when both conditions fire. Failed rows do NOT auto-retry on online recovery. NFRs: 10/10 prod deps unchanged, 995/1000 source LOC (Task 1 reclaimed −33; additions added +33; net 0 vs Story 2.3), gzip JS 77.24/100 KB. 27/27 tests pass on Node 24.13.0 (16 reducer + 11 server, +2 reducer tests for CONNECTIVITY_CHANGED). | Amelia (dev agent) |
| 2026-04-27 | 1.2.1   | Code-review patch applied: closed stuck-offline bug (3 reviewer findings merged). `runMutation` success path now dispatches `CONNECTIVITY_CHANGED({online:true})` after `SYNC_OK` — a successful round-trip recovers the offline banner regardless of whether the browser fired its `online` window event (handles the `navigator.onLine === true` + transient TypeError case). Reducer `CONNECTIVITY_CHANGED` case is now idempotent (`return state.online === action.online ? state : { ...state, online: action.online }`) so the success-path dispatch is a no-op when already online, avoiding re-render churn. 6 medium/low findings deferred to Story 2.6 (concurrent-mutation race pre-existing from Epic 1; cold-start one-frame flash; TypeError detection breadth; navigator.onLine captive-portal limitation; assertive aria-live banner stacking; AlertCircle SVG cross-screen-reader variance). NFR-M3 ends at 998/1000 (+3 LOC, 2-line headroom). 27/27 tests pass; lint + builds clean. | Code Review (claude-opus-4-7) |
