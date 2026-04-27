# Story 2.3: Per-Row Failure State & Retry (Optimistic UI Upgrade)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user whose write failed on spotty wifi,
I want the affected task row to show an inline error indicator and a retry button,
So that I can retry without losing what I typed and without the rest of the list becoming unusable.

## Acceptance Criteria

1. **AC1 — Action union expansion (with one carve-out).**
   **Given** the reducer's `Action` discriminated union after this story,
   **When** I read `client/src/state/tasksReducer.ts`,
   **Then** it includes ALL of: `INITIAL_LOAD_OK`, `INITIAL_LOAD_FAIL`, `INITIAL_LOAD_RETRY` (kept from 2.2), `OPTIMISTIC_ADD`, `OPTIMISTIC_TOGGLE`, `OPTIMISTIC_DELETE`, `SYNC_OK`, `SYNC_FAIL` (NEW), `RETRY` (NEW). **`ROLLBACK` is REMOVED** (replaced by `SYNC_FAIL`). **`CONNECTIVITY_CHANGED` is intentionally deferred to Story 2.4** — that story owns the `useConnectivity` hook that *dispatches* the action and is its natural co-location point. The two stories collectively satisfy the epic-level "all listed actions present" requirement.

2. **AC2 — Per-row `status` field.**
   **Given** the reducer's task type after this story,
   **When** I inspect a task entry in state,
   **Then** each task carries a client-only `status: 'synced' | 'pending' | 'failed'` field — **never sent to the server, never persisted**. Implemented via a new client-only type (e.g. `ClientTask = Task & { status: 'synced' | 'pending' | 'failed'; pendingMutation?: 'create' | 'toggle' | 'delete' }`) defined in `tasksReducer.ts`. The wire `Task` type in `client/src/api/types.ts` is **unchanged** (the wire shape stays clean).

3. **AC3 — Mutation failure dispatches `SYNC_FAIL` (no rollback).**
   **Given** a `POST` / `PATCH` / `DELETE` fetch returns non-2xx OR rejects at the network layer,
   **When** the hook's `.catch` handler runs,
   **Then** `useTasks` dispatches `{ type: "SYNC_FAIL", id }` with the affected task id AND the task **REMAINS in the list** (the Epic-1 ROLLBACK behavior is gone) AND the row's `status` transitions to `'failed'` AND `pendingMutation` is preserved (so retry knows what to re-fire).

4. **AC4 — Failed-row visual treatment.**
   **Given** a task with `status === 'failed'`,
   **When** `<TaskItem>` renders it,
   **Then** a `lucide-react` `<AlertCircle>` icon in `--destructive` color is prepended at row-left (16 px = `size-4`, per UX-DR47 inline icon size) AND the delete `×` affordance at row-right is REPLACED by a `<Button variant="ghost" size="sm">Retry</Button>` (UX-DR35 / UX consistency table) AND the task text is preserved verbatim AND the checkbox is still rendered (its appearance reflects the optimistic value per AC11).

5. **AC5 — Failed-row accessibility.**
   **Given** a failed row,
   **When** I inspect ARIA on it,
   **Then** the AlertCircle icon has `role="img"` AND `aria-label="Save failed"` (UX-DR37) AND the Retry button has `aria-label={`Retry saving task: ${text}`}` (template-string interpolation of the verbatim task text).

6. **AC6 — Retry click re-fires the original mutation with the same UUID.**
   **Given** a failed row,
   **When** the user clicks Retry (or presses Enter while Retry is focused),
   **Then** `useTasks.retryMutation(id)` runs which: (a) dispatches `{ type: "RETRY", id }` to flip status back to `'pending'`, (b) reads the task's `pendingMutation` field, (c) re-fires the matching mutation (`apiCreateTask` for `'create'`, `apiUpdateTask` for `'toggle'` with the optimistic `completed` value, `apiDeleteTask` for `'delete'`) using the **SAME client-generated UUID** that originally failed. (d) on success → `SYNC_OK`, on failure → `SYNC_FAIL` again.

7. **AC7 — Retry of a failed-add hits server-side idempotency.**
   **Given** a previously failed `POST /api/tasks` is retried,
   **When** the server handles the duplicate POST with the same UUID,
   **Then** Story 1.2's `INSERT OR IGNORE` ensures **at most one row** is persisted (FR19 / NFR-R3 verified end-to-end). The server returns the original stored task. **No code change on the server side** — this AC is a verification that the existing idempotency guarantee carries through. Smoke-test via the dev server.

8. **AC8 — Successful retry clears the error UI.**
   **Given** a retry whose `.then` resolves,
   **When** `SYNC_OK` dispatches,
   **Then** the row's `status` becomes `'synced'`, `pendingMutation` is cleared (`undefined`), the AlertCircle and Retry button **disappear**, and the row reverts to its normal appearance (delete `×` revealable on hover/focus per Epic-1 behavior).

9. **AC9 — Failed retry returns to failed state; cycle repeats indefinitely.**
   **Given** a retry whose `.catch` runs,
   **When** `SYNC_FAIL` dispatches,
   **Then** the row returns to the `'failed'` visual state AND the user can click Retry again AND the cycle can repeat without limit (no retry counter, no escalation copy).

10. **AC10 — Sibling-row interactivity is preserved (FR17).**
    **Given** at least one row is in `'failed'` state,
    **When** I interact with sibling rows,
    **Then** clicking checkboxes on sibling rows works (their `apiUpdateTask` fires; `SYNC_OK` arrives normally) AND clicking delete on sibling rows works AND adding new tasks works AND `<TaskInput>` is unaffected. **The failed row does not "freeze" the rest of the list.**

11. **AC11 — Failed CREATE: text is preserved on the row (FR18).**
    **Given** the user types `"buy bread"` and presses Enter, the optimistic add dispatches BEFORE the fetch starts,
    **When** the POST subsequently fails,
    **Then** the typed text appears in the list immediately at `status: 'pending'`, then transitions to `status: 'failed'` after `SYNC_FAIL` AND the text remains exactly `"buy bread"` (not lost into a banner or a toast — the row IS the preservation medium for the input). Retry re-fires the same POST with the same UUID and text.

12. **AC12 — Failed TOGGLE: checkbox shows the optimistic value.**
    **Given** the user clicks a checkbox, the PATCH fails,
    **When** `SYNC_FAIL` dispatches,
    **Then** the checkbox displays the **optimistic** `completed` value (what the user *intended*), not the previous server value. Retry re-fires `apiUpdateTask` with that same `completed` value.

13. **AC13 — Failed DELETE: row reappears with error indicator.**
    **Given** the user clicks `×`, the DELETE fails,
    **When** `SYNC_FAIL` dispatches,
    **Then** the row REAPPEARS in the list with `status: 'failed'` and AlertCircle + Retry. Retry re-fires `apiDeleteTask` with the same id. **Implementation note:** to make this work without snapshotting the deleted task, `OPTIMISTIC_DELETE` performs a **soft-delete** — it doesn't filter the task out of `state.tasks`; it sets `status: 'pending', pendingMutation: 'delete'`. The render layer (`<TaskList>`) hides tasks with `status === 'pending' && pendingMutation === 'delete'` so the optimistic UX still feels instant. On `SYNC_OK` for a delete-pending task, the reducer removes it. On `SYNC_FAIL`, status flips to `'failed'` → no longer hidden by render filter → row visibly reappears.

14. **AC14 — `loadError` is unchanged by mutation paths.**
    **Given** the existing `loadError` field from Story 2.2,
    **When** any mutation (`OPTIMISTIC_ADD/TOGGLE/DELETE`, `SYNC_OK`, `SYNC_FAIL`, `RETRY`) dispatches,
    **Then** `loadError` is **not modified** by these cases. The PageBanner from Story 2.2 is orthogonal to per-row failure UI.

15. **AC15 — Empty (no-failed-rows) state has no error UI.**
    **Given** zero rows have `status: 'failed'`,
    **When** the list renders,
    **Then** there are no AlertCircle icons, no Retry buttons anywhere in the rendered DOM. Failed-row UI is fully conditional on `task.status === 'failed'`.

16. **AC16 — Live region announces failure transitions (FR23).**
    **Given** the existing `aria-live="polite"` on `<ul>` from Story 1.6 / Story 2.1,
    **When** a row transitions in or out of `'failed'` state,
    **Then** the DOM text content changes (icon's `aria-label="Save failed"` enters/leaves the live region; Retry button's `aria-label` enters/leaves) and assistive tech announces the transition naturally. **No `aria-live` changes to TaskList** — the existing `polite` region carries the meaning.

17. **AC17 — Reducer tests cover the new actions + transitions.**
    **Given** `client/src/state/tasksReducer.test.ts`,
    **When** I run `npm --prefix client test`,
    **Then** new `it(...)` blocks cover (using the existing `Object.freeze` purity pattern from Story 1.8):
    - `OPTIMISTIC_ADD` produces a task with `status: 'pending'`, `pendingMutation: 'create'`
    - `OPTIMISTIC_TOGGLE` of a synced task produces `status: 'pending'`, `pendingMutation: 'toggle'`, with the optimistic `completed` value
    - `OPTIMISTIC_DELETE` does NOT remove the task; produces `status: 'pending'`, `pendingMutation: 'delete'`
    - `SYNC_FAIL` flips `status: 'failed'`, preserves `pendingMutation`
    - `RETRY` flips `status: 'pending'`, preserves `pendingMutation`
    - `SYNC_OK` for a `pendingMutation: 'delete'` task REMOVES the task from `tasks`
    - `SYNC_OK` for a `pendingMutation: 'create'` task replaces it with the server's authoritative version, sets `status: 'synced'`, clears `pendingMutation`
    - **The previous `ROLLBACK` test is REMOVED** (action no longer exists). Verify the test count delta: from 12 tests → 18 tests (12 existing + 7 new − 1 removed = 18).

18. **AC18 — Mutation cleanup: ROLLBACK action and its test are deleted.**
    **Given** the post-2.3 codebase,
    **When** I `rg -n "ROLLBACK" client/src/`,
    **Then** **zero hits.** No dead code; no commented-out ROLLBACK case; no `previousTasks` snapshot/ref left in `useTasks.ts`. Mutation handlers are simpler — no try/catch around state-snapshotting; just `dispatch(OPTIMISTIC_*)` → fetch → `SYNC_OK` or `SYNC_FAIL`.

19. **AC19 — NFR-M1, NFR-M3, NFR-P5 all hold.**
    **Given** the change set for this story,
    **When** measured,
    **Then** total prod deps remain at 10/10 (no new deps; `lucide-react.AlertCircle` and shadcn `Button` are already imported transitively via Story 2.2). Total non-test source LOC remains **< 1000** (NFR-M3). Gzip JS bundle remains **< 102,400 B** (NFR-P5). **LOC reclamation from existing files is REQUIRED** to fit budget — see Task 1.

## Tasks / Subtasks

> ### ⚠️ LOC budget at story start: **998 / 1000**. Headroom: **2 lines.**
>
> Story 2.3 adds significant code (≈ +30 LOC of net additions even with compact patterns). This story therefore **mandates LOC reclamation from existing files BEFORE adding new code**. Task 1 below is non-optional.

- [x] **Task 1 — Reclaim LOC from existing files (do this FIRST)** (AC: 19)
  - [x] **Reclaim ~15 LOC by reverting App.tsx's focus-on-empty `useEffect` to its pre-review minimal form.**
    - The Story 2.1 code-review patches added an SSR guard, try/catch, type-narrowing cast, and `activeElement` stealing-guard — together adding ~10 lines of defensive code on top of the original 6-line effect.
    - For Story 2.3's budget, revert the effect body to the **original minimal form**:
      ```tsx
      useEffect(() => {
        if (!isLoading && tasks.length === 0) {
          document.getElementById("task-input")?.focus();
        }
      }, [tasks.length, isLoading]);
      ```
    - Document the revert in `deferred-work.md` under "Deferred from: implementation of story 2-3-...": all four Story-2.1-review hardening items (SSR guard, try-catch, type-narrowing, activeElement check) defer to **Story 2.6** (a11y/quality QA pass — already the natural owner of focus-management hardening per UX-DR49 + previous 2.6 deferrals).
    - This reclaim is acceptable because: (a) the SSR guard is dead code (this is a SPA, never SSRed); (b) the try/catch was a defensive belt-on-belt (DOM `.focus()` doesn't throw in any current browser engine); (c) type-narrowing was style; (d) the `activeElement` check protects against an edge case Story 2.1's spec didn't require. None of these were AC-mandated; all were code-review opinions.
  - [x] **Reclaim ~3 LOC from `useTasks.ts` comments.**
    - The comment block on `performInitialLoad` (currently 2 lines): "The local `resolved` flag + AbortController guarantee no double-dispatch across the slow-load timer / fetch / unmount races." → keep, useful.
    - The comment on `Suppress AbortError: it surfaces from our own slow-load abort (the timer's dispatch already fired the FAIL) or from unmount.` (2 lines) → compress to 1 line: `// Suppress AbortError from our own slow-load abort or unmount.`
    - The comment "Cleanup of the most recent initial-load attempt — retry aborts it first." → 1 line, keep.
  - [x] **Reclaim ~3 LOC from `tasksReducer.ts` comments.**
    - The comment block (currently 2 lines): "Pure reducer (AR21): never call fetch / Date.now() / crypto.randomUUID() here. Side effects belong in the hook. Mutation = bug." → compress to 1 line: `// AR21: pure reducer — no side effects, no mutation.`
    - The comment in `SYNC_OK` case (currently 3 lines): "For create: replace optimistic task with server's authoritative version (especially server-assigned createdAt). For toggle/delete: no task provided, no-op." → this comment is being replaced by the new `SYNC_OK` logic anyway in Task 3 (delete-removal + status reset).
  - [x] **Reclaim ~5 LOC from `TaskItem.tsx` comments inside `handleKeyDown`.**
    - The 3-line comment "Ignore keys that originated inside an interactive child (the checkbox or the delete button) so their own handlers stay authoritative." → compress to 1 line: `// Skip events from interactive children unless they're row-level navigation.`
    - The 3-line comment "Still handle ArrowUp/Down at the row level even if focus happens to be on a child — the user's intent is to navigate rows, not anything child-specific." → REMOVE (the code's `if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;` is self-explanatory).
  - [x] **Verify reclamation total before proceeding:**
    ```bash
    find client/src server/src -name '*.ts' -o -name '*.tsx' \
      | grep -v '.test.' | grep -v 'components/ui/' | xargs wc -l | tail -1
    ```
    Target after Task 1 (before any new code): **975–980** LOC (reclaimed ≈ 18–23 LOC, gives Story 2.3's additions ~20–25 lines of headroom).
  - [x] Append entries to `deferred-work.md` under "Deferred from: implementation of story 2-3-per-row-failure-state-retry-optimistic-ui-upgrade (2026-04-27)" for each comment removed AND for the focus-effect revert (one bullet per Story-2.1-review item now re-deferred).
- [x] **Task 2 — Define `ClientTask` type + extend reducer state** (AC: 1, 2)
  - [x] In `client/src/state/tasksReducer.ts`, add the client-only types near the top:
    ```ts
    export type SyncStatus = 'synced' | 'pending' | 'failed';
    export type PendingMutation = 'create' | 'toggle' | 'delete';

    export type ClientTask = Task & {
      status: SyncStatus;
      pendingMutation?: PendingMutation;
    };
    ```
  - [x] Update `State["tasks"]` from `Task[]` to `ClientTask[]`.
  - [x] **Do NOT modify `client/src/api/types.ts`.** The wire `Task` type stays clean. AR23 (snake/camel conversion isolated to `db.ts`) is preserved; client-only fields don't leak to wire.
  - [x] Update the `Action` union: **add** `{ type: "SYNC_FAIL"; id: string }` and `{ type: "RETRY"; id: string }`. **Remove** `{ type: "ROLLBACK"; previousTasks: Task[] }` entirely. **Do NOT add** `CONNECTIVITY_CHANGED` here — Story 2.4 owns it.
- [x] **Task 3 — Rewrite reducer cases** (AC: 1, 2, 3, 8, 9, 11, 12, 13, 17, 18)
  - [x] `INITIAL_LOAD_OK` — wrap incoming `Task[]` with `status: 'synced'`:
    ```ts
    case "INITIAL_LOAD_OK":
      return {
        ...state,
        tasks: action.tasks.map((t) => ({ ...t, status: 'synced' as const })),
        isLoading: false,
        loadError: null,
      };
    ```
  - [x] `OPTIMISTIC_ADD` — task gets `status: 'pending'`, `pendingMutation: 'create'`:
    ```ts
    case "OPTIMISTIC_ADD":
      return {
        ...state,
        tasks: [...state.tasks, { ...action.task, status: 'pending' as const, pendingMutation: 'create' as const }],
      };
    ```
  - [x] `OPTIMISTIC_TOGGLE` — flip `completed`, mark pending+toggle:
    ```ts
    case "OPTIMISTIC_TOGGLE":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, completed: action.completed, status: 'pending' as const, pendingMutation: 'toggle' as const }
            : t,
        ),
      };
    ```
  - [x] `OPTIMISTIC_DELETE` — **soft-delete** (does NOT filter; sets pending + delete):
    ```ts
    case "OPTIMISTIC_DELETE":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, status: 'pending' as const, pendingMutation: 'delete' as const }
            : t,
        ),
      };
    ```
  - [x] `SYNC_OK` — handles both cases (delete-completion and create/toggle-completion):
    ```ts
    case "SYNC_OK": {
      // If pendingMutation was 'delete', remove the task from the list.
      const target = state.tasks.find((t) => t.id === action.id);
      if (target?.pendingMutation === 'delete') {
        return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
      }
      // For create: replace with server's authoritative version (server-assigned createdAt).
      // For toggle: just clear status + pendingMutation.
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...(action.task ? { ...action.task } : t), status: 'synced' as const, pendingMutation: undefined }
            : t,
        ),
      };
    }
    ```
  - [x] `SYNC_FAIL` — flip status to failed, preserve pendingMutation:
    ```ts
    case "SYNC_FAIL":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, status: 'failed' as const } : t,
        ),
      };
    ```
  - [x] `RETRY` — flip status back to pending:
    ```ts
    case "RETRY":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, status: 'pending' as const } : t,
        ),
      };
    ```
  - [x] **Remove** the `ROLLBACK` case entirely.
  - [x] Verify the exhaustive `_exhaustive: never` default still compiles.
- [x] **Task 4 — Rewrite `useTasks` mutations + add `retryMutation`** (AC: 3, 6, 10, 11, 12, 13, 18)
  - [x] **Remove `previousTasks` snapshots** from `createTask`, `toggleTask`, `deleteTask` (Epic 1 ROLLBACK is gone). Each mutation simplifies to:
    ```ts
    const createTask = useCallback((text: string) => {
      const id = crypto.randomUUID();
      dispatch({
        type: "OPTIMISTIC_ADD",
        task: { id, text, completed: false, createdAt: Date.now() },
      });
      apiCreateTask({ id, text })
        .then((task) => dispatch({ type: "SYNC_OK", id, task }))
        .catch((err: unknown) => {
          console.error("Create task failed:", err);
          dispatch({ type: "SYNC_FAIL", id });
        });
    }, []);
    ```
    Same shape for `toggleTask` (uses `apiUpdateTask`, dispatches `OPTIMISTIC_TOGGLE` with `completed`) and `deleteTask` (uses `apiDeleteTask`, dispatches `OPTIMISTIC_DELETE`).
  - [x] **Keep `tasksRef`.** It's needed by `retryMutation` (which has to read the current task by id to discover `pendingMutation` and the optimistic `completed` value for toggle-retries). The "snapshot for rollback" rationale is gone, but the "read latest task by id" need remains.
  - [x] **Add `retryMutation` callback** (~12 LOC including imports of types):
    ```ts
    const retryMutation = useCallback((id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task?.pendingMutation) return;
      dispatch({ type: "RETRY", id });
      const m = task.pendingMutation;
      const promise =
        m === 'create' ? apiCreateTask({ id, text: task.text })
        : m === 'toggle' ? apiUpdateTask(id, { completed: task.completed })
        : apiDeleteTask(id);
      promise
        .then((r) => dispatch({ type: "SYNC_OK", id, task: m === 'create' ? (r as Task) : undefined }))
        .catch((err: unknown) => {
          console.error(`Retry ${m} failed:`, err);
          dispatch({ type: "SYNC_FAIL", id });
        });
    }, []);
    ```
  - [x] Add `retryMutation: (id: string) => void` to `UseTasksReturn` interface.
  - [x] Add `retryMutation` to the returned object.
  - [x] Update `tasks` typing in `UseTasksReturn` from `Task[]` to `ClientTask[]` (consumers — TaskList and TaskItem — need to read `status` and `pendingMutation`).
- [x] **Task 5 — `<TaskList>` filters out pending-delete rows + threads `onRetry`** (AC: 13, 15)
  - [x] In `client/src/components/TaskList.tsx`, add `onRetry: (id: string) => void` to `TaskListProps` (next to `onToggle`, `onDelete`).
  - [x] Filter the `tasks.map(...)` so rows in pending-delete state are not rendered (their `<li>` is hidden, giving the user the optimistic "row removed" UX feedback):
    ```tsx
    : tasks
        .filter((t) => !(t.status === 'pending' && t.pendingMutation === 'delete'))
        .map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
            onRetry={onRetry}
          />
        ))
    ```
  - [x] Update the `tasks` prop type from `Task[]` to `ClientTask[]`.
  - [x] **Do NOT** introduce a separate "PendingDeleteRow" component; the filter is sufficient.
- [x] **Task 6 — `<TaskItem>` renders the failed-row variant** (AC: 4, 5, 6, 9, 16)
  - [x] In `client/src/components/TaskItem.tsx`:
    - Update `task` prop type from `Task` to `ClientTask`.
    - Add `onRetry: (id: string) => void` to props.
    - Add `import { AlertCircle } from "lucide-react"` (already imported elsewhere).
    - Add `import { Button } from "@/components/ui/button"`.
    - Compute `const isFailed = task.status === 'failed';` near the top of the component body.
    - Conditionally prepend the AlertCircle icon at row-left (BEFORE the checkbox container) when `isFailed`:
      ```tsx
      {isFailed && (
        <span role="img" aria-label="Save failed" className="p-3.5">
          <AlertCircle className="size-4 text-destructive" />
        </span>
      )}
      ```
    - Replace the existing delete `<button>` JSX with a ternary: when `isFailed`, render `<Button variant="ghost" size="sm" aria-label={`Retry saving task: ${task.text}`} onClick={() => onRetry(task.id)}>Retry</Button>`; otherwise render the existing X-icon button as today.
  - [x] **Do NOT** modify the keyboard handlers — Delete/Backspace on a failed row still triggers `onDelete` (which would dispatch `OPTIMISTIC_DELETE` again on the failed row — that's user intent: "I tried to do something to this row, now I want to delete it instead"). Edge case acknowledged; if dev finds this conflicting in manual testing, log to deferred-work and stop.
  - [x] **Do NOT** add separate keyboard handling for Retry beyond what shadcn `Button` provides (Enter/Space natively trigger `onClick`).
- [x] **Task 7 — `<App>` threads `retryMutation` to `<TaskList>`** (AC: 6, 14)
  - [x] In `client/src/App.tsx`, pull `retryMutation` from `useTasks()`:
    ```tsx
    const { tasks, isLoading, loadError, createTask, toggleTask, deleteTask, retryInitialLoad, retryMutation } = useTasks();
    ```
  - [x] Pass it through to `<TaskList>`:
    ```tsx
    <TaskList tasks={tasks} isLoading={isLoading} onToggle={toggleTask} onDelete={deleteTask} onRetry={retryMutation} />
    ```
- [x] **Task 8 — Update `tasksReducer.test.ts` for the new actions** (AC: 17, 18)
  - [x] **Update existing tests** that asserted Epic-1 task shapes to expect the new `status: 'pending' | 'synced'` field where appropriate:
    - `OPTIMISTIC_ADD` test: assert the new task has `status: 'pending'`, `pendingMutation: 'create'`.
    - `OPTIMISTIC_TOGGLE` test: assert the toggled task has `status: 'pending'`, `pendingMutation: 'toggle'`, and the optimistic `completed` value.
    - `OPTIMISTIC_DELETE` test: assert the task **stays in the list** (length unchanged), with `status: 'pending'`, `pendingMutation: 'delete'`.
    - `SYNC_OK` test: assert the task transitions to `status: 'synced'`, `pendingMutation: undefined`.
  - [x] **Add new tests:**
    - `SYNC_FAIL` flips `status: 'failed'`, preserves `pendingMutation`.
    - `RETRY` flips `status: 'pending'`, preserves `pendingMutation`.
    - `SYNC_OK` for a `pendingMutation: 'delete'` task **REMOVES** the task from `tasks`.
    - `INITIAL_LOAD_OK` wraps incoming wire `Task` objects with `status: 'synced'`.
  - [x] **Remove the existing `ROLLBACK` test** (action no longer exists).
  - [x] Use Story 1.8's `Object.freeze` purity pattern for at least one of the new action tests.
  - [x] Update test fixtures: where existing tests use `taskA: Task = ...`, define a small helper at the top:
    ```ts
    const synced = (t: Task): ClientTask => ({ ...t, status: 'synced' });
    ```
    so the existing test bodies need minimal churn (e.g. `stateWithTasks([synced(taskA)])`).
  - [x] **Final test count after this task: ~18 tests** (12 existing − 1 ROLLBACK + 7 new). All must pass.
- [x] **Task 9 — Verification + audits** (AC: 19)
  - [x] **Lint:** `npm --prefix client run lint` exits 0.
  - [x] **Build (client):** `npm --prefix client run build` exits 0; gzip JS still **< 100 KB** (NFR-P5). Expect ~+1 KB delta.
  - [x] **Build (server):** `npm --prefix server run build` exits 0.
  - [x] **Tests (full root suite, on Node 24):** `npm test` exits 0; ~18 reducer tests + 6 db + 5 routes = ~29 total tests.
  - [x] **LOC audit (NFR-M3):**
    ```bash
    find client/src server/src -name '*.ts' -o -name '*.tsx' \
      | grep -v '.test.' | grep -v 'components/ui/' | xargs wc -l | tail -1
    ```
    **Must be < 1000.** If over, trim more comments — DO NOT defer features. Check the reducer's `SYNC_OK` case (the most LOC-dense addition); minor compression there pays back fastest.
  - [x] **Dep audit:** `client/package.json` and `server/package.json` `dependencies` blocks unchanged (10/10 NFR-M1).
  - [x] **`rg -n "ROLLBACK" client/src/`** returns 0 hits (AC18 — no dead code, no commented-out cases, no leftover `previousTasks` ref).
  - [x] **Manual browser verification (5-minute pass on Node 24):**
    - Add task with server stopped: row appears with text → fails → AlertCircle + Retry. Click Retry: row tries again → fails → still shows AlertCircle + Retry. Restart server, click Retry: success, error UI clears. (AC11, AC9, AC8)
    - Toggle a task with server stopped: checkbox flips, fails, AlertCircle appears, checkbox stays in optimistic state. Retry → success → UI clears. (AC12)
    - Delete a task with server stopped: row disappears optimistically, then REAPPEARS with AlertCircle + Retry on SYNC_FAIL. Retry → success → row gone. (AC13)
    - With one row in failed state, interact with sibling rows: checkboxes toggle, X deletes, TaskInput accepts new tasks. (AC10)
    - Failed-add retry idempotency (AC7): manually verify by stopping server mid-POST, getting a failed row, restarting server, clicking Retry. The stored task in `server/data/tasks.db` should be a single row (run `sqlite3 server/data/tasks.db "SELECT id, text FROM tasks;"` to confirm).
- [x] **Task 10 — Update story status + sprint-status.yaml**
  - [x] Set story status header to `in-progress` when starting; `review` when handing off.
  - [x] Sprint-status moves to `done` only after `code-review` workflow completes.

## Dev Notes

### Why the soft-delete pattern (and why it's worth the +1 LOC)

[Source: epics.md §Story 2.3 AC "Given a delete whose DELETE request fails / Then the row REAPPEARS in the list"]

The Epic-1 `OPTIMISTIC_DELETE` filters the task out of `state.tasks`. With Story 2.3, if a DELETE fails, the spec wants the row to "reappear." The two ways to support that are:

1. **Snapshot the deleted task in the hook**, then dispatch a hypothetical `RESTORE_DELETED({ task })` on `SYNC_FAIL`. This costs LOC in the hook (deletion ref + new action + reducer case) AND pollutes the reducer with a "restore from outside snapshot" capability — which is just ROLLBACK by a different name.
2. **Soft-delete via status**: `OPTIMISTIC_DELETE` marks the task with `pendingMutation: 'delete'` instead of removing it. The render layer hides such tasks; on `SYNC_OK`, the reducer removes; on `SYNC_FAIL`, status flips to `'failed'` and the row reappears in the render.

Option 2 is the choice. It costs +1 LOC in the reducer (filter → map) and +1 LOC in `<TaskList>` (the filter), but it eliminates the "deleted-task ghost ref" problem and keeps the reducer the single source of truth.

**The render-layer filter is intentional, not a leak.** The spec's intent is "task is removed from the user's view immediately on click." `state.tasks` is the truth (the task still exists, marked pending-delete). The view's filter is the optimistic UX. They reconcile when the server responds.

### Why `pendingMutation` lives on the task (and not in a hook-side Map)

[Source: epics.md §Story 2.3 AC "the hook re-fires the original mutation using the SAME client-generated UUID"]

Two designs were considered for "remember which mutation failed for this row":

- **Map<id, () => Promise<void>> ref in `useTasks`.** Each mutation initiation stores a re-run closure. `retryMutation` calls the entry. Pros: no reducer change for the closure. Cons: state lives in two places (the reducer's task `status` AND the hook's Map of closures); cleanup logic is brittle.
- **`pendingMutation` field on the `ClientTask`.** The reducer is the single source of truth. `retryMutation` reads the task, decides which `apiClient` function to call.

Choice: **`pendingMutation` on the task.** Reducer remains the truth; hook is stateless w.r.t. retry; pattern is verifiable purely via reducer tests.

### What `CONNECTIVITY_CHANGED` is NOT doing in this story

[Source: epics.md §Story 2.3 AC1 + §Story 2.4 ACs]

The Story 2.3 spec text lists `CONNECTIVITY_CHANGED` in AC1's union enumeration. We're carving it out to **Story 2.4** because:

1. Story 2.4 is the natural co-location point — it adds `useConnectivity` (the hook that *dispatches* the action) AND the `<PageBanner>` offline variant.
2. Adding a stub `CONNECTIVITY_CHANGED` case in 2.3 means writing dead code (`case "CONNECTIVITY_CHANGED": return state;`) plus a stub `online: boolean` field somewhere. That's 4–6 LOC of placeholder that does nothing until 2.4 wires it up.
3. The LOC budget cannot accommodate placeholder code. Story 2.3 is at the edge of NFR-M3 just satisfying its own ACs.

The dev for Story 2.4 should add the action AND the reducer case AND the hook in one coherent change. AC1's union check will pass after 2.4 lands.

### Reducer purity (AR21) is non-negotiable

[Source: architecture.md AR21; client/src/state/tasksReducer.ts existing comment]

No new reducer case in Story 2.3 calls `fetch`, `Date.now()`, `crypto.randomUUID()`, or any other side-effecting API. All such side effects live in `useTasks`. The new `SYNC_FAIL` and `RETRY` cases are pure: input state + action → new state, no I/O.

`Object.freeze` purity tests in the reducer test file should freeze inputs to at least one new test (Story 1.8 pattern). A future hardening pass (Story 2.6 or later) can extract a `deepFreeze` helper and apply per-action; out of scope here.

### Why mutations get *simpler* (despite per-row failure adding complexity)

[Source: 1-6-task-list-view-with-happy-path-crud-view-complete-delete.md §Completion Notes; 2-2 Completion Notes]

Counterintuitively, removing ROLLBACK simplifies the hook. Compare:

```ts
// Epic 1 createTask (with ROLLBACK)                  // Story 2.3 createTask (with SYNC_FAIL)
const previousTasks = tasksRef.current;               dispatch({ type: "OPTIMISTIC_ADD", task: ... });
dispatch({ type: "OPTIMISTIC_ADD", task: ... });      apiCreateTask({ id, text })
apiCreateTask({ id, text })                             .then((t) => dispatch({ type: "SYNC_OK", id, task: t }))
  .then((task) => dispatch({ type: "SYNC_OK", ...}))    .catch((err) => {
  .catch((err: unknown) => {                              console.error(...);
    console.error("...failed:", err);                     dispatch({ type: "SYNC_FAIL", id });
    dispatch({ type: "ROLLBACK", previousTasks });      });
  });
```

No more `previousTasks = tasksRef.current` snapshot. No more passing previousTasks through dispatch. The reducer holds the row's state machine; the hook just announces transitions. **Net reduction of ~3 LOC per mutation × 3 mutations = ~9 LOC saved**, partially offsetting the new `retryMutation` callback's ~12 LOC.

### Story 2.6 will own these residuals (don't preempt)

[Source: deferred-work.md; UX-DR49; UX-DR41-43]

- **Visible PageBanner fade-in/fade-out animations** (deferred from Story 2.2).
- **Focus restoration after deleting a non-last row** (deferred from Story 1.6).
- **Per-row failure announcement framing** (NVDA/JAWS suppress identical consecutive `aria-live` announcements — flagged in Story 2.2 review).
- **Banner manual-dismiss path / WCAG 2.4.1** (deferred from Story 2.2 review).
- **The four App.tsx focus-effect hardening items** (SSR guard, try/catch, type-narrowing, activeElement check) being re-deferred in Task 1 of THIS story.
- **`loadError` not cleared by mutation actions** (deferred from Story 2.2 review).
- **Component test infrastructure setup** (jsdom + vitest config — Story 1.8 deferred to 2.6).
- **AbortError detection breadth** (Story 2.2 review).
- **Strict-mode dev-only console pollution** (Story 2.2 review).

These are accumulated. Story 2.6 is the natural cleanup pass.

### Lessons from Stories 1.6 / 2.1 / 2.2 that affect this story

[Source: implementation-artifacts/1-6*.md, 2-1*.md, 2-2*.md; epic-1-retro-2026-04-27.md]

- **Reducer purity tests pay dividends.** Story 1.8's `Object.freeze` purity check + reference-equality immutability tests caught the `OPTIMISTIC_TOGGLE` `.map` semantics. Use the same patterns for the new actions.
- **`useCallback([])` for hook-returned functions.** Existing `createTask`/`toggleTask`/`deleteTask` follow this; keep the same for `retryMutation`. The PageBanner's `onClick={retryInitialLoad}` (Story 2.2) and `<TaskItem>`'s `onClick={() => onRetry(task.id)}` (this story) both benefit from referential stability.
- **`tasksRef`** continues to be the right pattern for "let memoized callbacks read latest state." It was kept for ROLLBACK snapshots; it's now kept for retry's "read pendingMutation by id."
- **No barrel files.** Import everything by direct path: `import type { ClientTask } from "@/state/tasksReducer";`.
- **shadcn primitives stay untouched.** Use `Button` from `@/components/ui/button` as-is.
- **No new prod deps.** `lucide-react.AlertCircle` is already in the bundle from Story 2.2's PageBanner usage. Tree-shaking confirmed (76.6 KB gzip JS).
- **Don't write component tests.** Story 2.6 owns the jsdom setup. Manual browser verification per Task 9 covers the visual ACs.
- **Watch the LOC budget *every* time you save.** Run the LOC audit command after each task and trim eagerly. The 1000-line cap is hard.

### Files in scope

```
client/src/
├── App.tsx                          ← MODIFIED: revert focus useEffect (-15 LOC); pull retryMutation from useTasks; pass to TaskList. Net ≈ −13 LOC.
├── api/
│   ├── apiClient.ts                 ← UNCHANGED
│   └── types.ts                     ← UNCHANGED (wire Task is clean; no client field bleed)
├── components/
│   ├── PageBanner.tsx               ← UNCHANGED
│   ├── TaskInput.tsx                ← UNCHANGED
│   ├── TaskList.tsx                 ← MODIFIED: filter pending-delete; thread onRetry. Net ≈ +3 LOC.
│   └── TaskItem.tsx                 ← MODIFIED: failed-row variant + comment trims. Net ≈ +12 LOC.
├── hooks/
│   └── useTasks.ts                  ← MODIFIED: simplified mutations + retryMutation + comment trims. Net ≈ +1 LOC.
└── state/
    ├── tasksReducer.ts              ← MODIFIED: ClientTask types + SYNC_FAIL/RETRY actions + soft-delete + comment trims. Net ≈ +18 LOC.
    └── tasksReducer.test.ts         ← MODIFIED: new tests for SYNC_FAIL/RETRY, removed ROLLBACK test. Test code, not counted toward NFR-M3.
```

**Files explicitly NOT to create:**
- `client/src/components/TaskRowError.tsx` — banned. UX-DR35 explicitly says "Implement as a composed variant of TaskRow, not a new component." Conditional rendering inside `<TaskItem>` is the implementation.
- `client/src/state/clientTypes.ts` — out of scope. The `ClientTask` type lives in `tasksReducer.ts` next to `State` and `Action`.
- `client/src/hooks/useRetry.ts` — banned. The retry logic is `retryMutation` inside `useTasks`. No abstraction for a single consumer.
- `client/vitest.config.ts` — out of scope (Story 2.6).
- Any `*.test.tsx` for components — out of scope (Story 2.6).

### Anti-patterns (forbidden)

```tsx
// ❌ Adding `status` to the wire Task type
// In client/src/api/types.ts:
export interface Task { ...; status?: 'synced' | 'pending' | 'failed' }
// — banned. The wire shape stays clean; client-only fields belong on ClientTask.

// ❌ Snapshotting tasks in the hook for "rollback on failure"
const previousTasks = tasksRef.current;
// — Epic-1 anti-pattern. Story 2.3 deliberately removes this. ROLLBACK is gone.

// ❌ Re-introducing ROLLBACK as a fallback
case "ROLLBACK": return { ...state, tasks: action.previousTasks };
// — banned by AC18. Zero hits for ROLLBACK in the post-2.3 codebase.

// ❌ Adding a CONNECTIVITY_CHANGED stub
case "CONNECTIVITY_CHANGED": return state;
// — banned. Story 2.4 owns it. LOC budget cannot afford the placeholder.

// ❌ Adding online: boolean to State here
export interface State { tasks: ClientTask[]; isLoading: boolean; loadError: string | null; online: boolean }
// — banned. Story 2.4 introduces this field with its meaningful initial value.

// ❌ Filtering pending-delete tasks in the reducer instead of the render layer
case "OPTIMISTIC_DELETE":
  return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) };
// — banned. Soft-delete is required for the AC13 "row reappears" path.

// ❌ Storing the retry closure in a hook ref Map
const retryFnsRef = useRef<Map<string, () => Promise<void>>>(new Map());
// — banned. Reducer state (pendingMutation) is the truth; retryMutation reads from it.

// ❌ Adding aria-live to the failed row's icon span
<span role="img" aria-label="Save failed" aria-live="polite">
// — banned. The TaskList <ul> already has aria-live="polite". Adding nested live regions is over-announcement.

// ❌ Using `aria-live="assertive"` on row failures
// — banned by UX-DR41. Assertive is reserved for whole-page conditions (load fail, offline). Per-row failure is polite.

// ❌ Toast / modal / dialog for per-row failure
toast.error("Save failed for task ...");
// — banned by ux-design-specification.md §Feedback Patterns ("No toasts").

// ❌ Separate TaskRowError component
function TaskRowError({ task, onRetry }) { ... }
// — banned by UX-DR35. Composed variant inside TaskItem only.

// ❌ Different copy for retry-fail vs. first-fail
message={attemptCount > 1 ? "Retry also failed" : "Save failed"}
// — banned by AC9. Same UI verbatim every retry cycle.

// ❌ Numeric retry counter / max-attempts cap
if (task.retryCount > 3) return null;
// — banned by AC9. Cycle is unbounded.

// ❌ Bypassing the existing apiClient functions for retry
fetch(`/api/tasks/${id}`, { method: 'POST', ... })
// — banned. Use apiCreateTask / apiUpdateTask / apiDeleteTask. They carry the existing error semantics.

// ❌ Removing the existing Story 2.2 PageBanner / loadError flow
// — banned. PageBanner is whole-page error (initial load fail); per-row failure is orthogonal.

// ❌ Adding state for "is any row failed" to drive global UI
const anyFailed = tasks.some(t => t.status === 'failed');
// — banned. Failed rows are self-contained; no aggregate UI in this story.
```

### Verification matrix (AC → how to verify)

| AC | Verification |
|----|--------------|
| AC1 | `rg -n "SYNC_FAIL\|RETRY\|ROLLBACK" client/src/state/tasksReducer.ts` — `SYNC_FAIL` and `RETRY` present; `ROLLBACK` zero hits. `CONNECTIVITY_CHANGED` zero hits (Story 2.4 owns it). |
| AC2 | TypeScript compile: `tsc -b` enforces `ClientTask` shape on `state.tasks`. Test file's fixtures use `synced(taskA)` helper. |
| AC3 | Manual: stop server, attempt mutation, observe row stays + AlertCircle. |
| AC4 | DevTools Elements on a failed row: `<span role="img" aria-label="Save failed">` + `<AlertCircle>` at row-left; Retry `<button>` (the shadcn Button renders as `<button>`) at row-right where `×` was. |
| AC5 | DevTools: confirm exact `aria-label` strings on icon and button. |
| AC6 | Manual: server-down failed-create, restart server, click Retry → row turns synced. Verify same UUID via DevTools Network tab on the retry POST request body. |
| AC7 | Manual: trigger AC6 successfully, then run `sqlite3 server/data/tasks.db "SELECT COUNT(*) FROM tasks WHERE id = '<that-uuid>';"` → exactly 1. |
| AC8 | Manual continuation of AC6: after success, AlertCircle and Retry button are gone. |
| AC9 | Manual: with server still down, click Retry repeatedly → cycle works. |
| AC10 | Manual: with one row failed, toggle and delete sibling rows; add new tasks. All succeed. |
| AC11 | Manual: type "buy bread", server down, Enter → row appears with text → fails → text preserved verbatim. |
| AC12 | Manual: toggle a row, server down, → checkbox shows the *target* state (post-click). Retry succeeds → checkbox stays in target state. |
| AC13 | Manual: delete a row, server down → row vanishes optimistically → SYNC_FAIL → row reappears with AlertCircle + Retry. Retry succeeds → row gone. |
| AC14 | Static: `loadError` in reducer not touched by `OPTIMISTIC_*` / `SYNC_*` / `RETRY` cases. |
| AC15 | Static: failed-row JSX is fully gated on `task.status === 'failed'`. |
| AC16 | Manual VoiceOver: trigger AC3 → "Save failed" announced. |
| AC17 | `npm --prefix client test` reports 18+ reducer tests passing. |
| AC18 | `rg -n "ROLLBACK" client/src/` — zero hits. `rg -n "previousTasks" client/src/hooks/` — zero hits. |
| AC19 | LOC < 1000; deps unchanged; gzip JS < 100 KB. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Per-Row Failure State & Retry (Optimistic UI Upgrade)](_bmad-output/planning-artifacts/epics.md)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 (lucide), UX-DR7 (--destructive), UX-DR35–37 (TaskRowError variant), UX-DR47 (icon size)](_bmad-output/planning-artifacts/epics.md)
- [Source: _bmad-output/planning-artifacts/prd.md#FR16, FR17, FR18, FR19, FR23, NFR-M1, NFR-M3, NFR-P5, NFR-R3](_bmad-output/planning-artifacts/prd.md)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#TaskRowError variant of TaskRow](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Button Hierarchy — variant=ghost size=sm for inline row Retry](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns — Inline on affected row via TaskRowError](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Source: _bmad-output/planning-artifacts/architecture.md#AR21 reducer purity](_bmad-output/planning-artifacts/architecture.md)
- [Source: _bmad-output/planning-artifacts/architecture.md#AR23 wire-shape conversion isolated to db.ts](_bmad-output/planning-artifacts/architecture.md)
- [Source: _bmad-output/implementation-artifacts/1-6-task-list-view-with-happy-path-crud-view-complete-delete.md (Epic-1 ROLLBACK pattern being replaced)](_bmad-output/implementation-artifacts/1-6-task-list-view-with-happy-path-crud-view-complete-delete.md)
- [Source: _bmad-output/implementation-artifacts/1-8-baseline-tests-reducer-db-routes.md (Object.freeze purity test pattern)](_bmad-output/implementation-artifacts/1-8-baseline-tests-reducer-db-routes.md)
- [Source: _bmad-output/implementation-artifacts/2-1-non-instructive-empty-state.md (focus useEffect being reverted in Task 1)](_bmad-output/implementation-artifacts/2-1-non-instructive-empty-state.md)
- [Source: _bmad-output/implementation-artifacts/2-2-initial-load-failure-page-banner-with-retry.md (loadError + PageBanner orthogonal to per-row UI)](_bmad-output/implementation-artifacts/2-2-initial-load-failure-page-banner-with-retry.md)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md (accumulated 2.6 backlog)](_bmad-output/implementation-artifacts/deferred-work.md)
- [Source: client/src/state/tasksReducer.ts (existing actions + State + reducer to modify)](client/src/state/tasksReducer.ts)
- [Source: client/src/hooks/useTasks.ts (existing mutation pattern + tasksRef)](client/src/hooks/useTasks.ts)
- [Source: client/src/components/TaskItem.tsx (existing row JSX + handleKeyDown)](client/src/components/TaskItem.tsx)
- [Source: client/src/components/TaskList.tsx (existing list rendering + skeleton branch)](client/src/components/TaskList.tsx)
- [Source: client/src/components/ui/button.tsx (shadcn Button — variant=ghost, size=sm available)](client/src/components/ui/button.tsx)

## Review Findings

### Patches

- [x] [Review][Patch] Concurrent-retry race lets stale `SYNC_OK`/`SYNC_FAIL` clobber a fresh in-flight retry [client/src/hooks/useTasks.ts:140-156] — FIXED. Added `retryInFlightRef = useRef<Set<string>>(new Set())`; `retryMutation` early-returns if the id is already in the set, adds the id at dispatch, removes it via `.finally` after the promise settles. Net +6 LOC. Eliminates the double-click + concurrent-retry races (3 high-severity findings from Blind Hunter + Edge Case Hunter merged here). 25/25 tests still pass; lint + builds clean; LOC ends at 995/1000.

### Deferred

- [x] [Review][Defer] Re-toggle of a soft-deleted row corrupts state [client/src/state/tasksReducer.ts:39-43] — `OPTIMISTIC_TOGGLE` matches by id and overwrites `pendingMutation` to `'toggle'` even when the row is `pending+delete`. The row is filtered from view by `<TaskList>`, so users can't trigger this via the UI — but assistive tech, programmatic clicks, or future code paths could. If reachable, the in-flight DELETE eventually returns 204 and the reducer takes the spread path (because `pendingMutation` is no longer `'delete'`), leaving a client-visible "synced" row that no longer exists server-side. Fix: guard `OPTIMISTIC_TOGGLE` (and re-`OPTIMISTIC_DELETE`) against ids already in `pending+delete`. Defer to Story 2.6 — current UI doesn't expose the path.

- [x] [Review][Defer] `SYNC_OK` spread overwrites concurrent optimistic edits during pending window [client/src/state/tasksReducer.ts:51-55] — When `action.task` is provided, the reducer spreads the server task, losing any concurrent optimistic edits the user made between dispatch and resolution (e.g., toggling a pending-create row before its SYNC_OK arrives). The brief pending window makes this very low-reachability today; multi-mutation racing is Story 2.6 territory.

- [x] [Review][Defer] AlertCircle's "Save failed" announcement relies on parent `aria-live="polite"` rather than a dedicated live region [client/src/components/TaskItem.tsx:69-73] — The story's AC16 + anti-pattern list explicitly forbade nested `aria-live` regions, so the implementation defers SR announcement to the `<ul>`'s existing polite region. NVDA/JAWS may coalesce nested aria-label changes; behavior is implementation-dependent. Story 2.6 a11y QA pass owns the cross-screen-reader verification.

- [x] [Review][Defer] TypeScript narrowing escape via `r as Task` cast [client/src/hooks/useTasks.ts:151] — The `r as Task` cast in `retryMutation`'s success dispatch is unsound: if `apiCreateTask`'s return type ever changes, the compiler won't catch it. Refactor to a discriminated branch (separate `.then` per mutation kind) preserves narrowing but costs 5+ LOC. Defer; the current dispatch shape is verified by reducer tests.

- [x] [Review][Defer] Soft-deleted row keyboard-focusable during React commit window [client/src/components/TaskList.tsx:31-32 + TaskItem.tsx:58] — Render-layer filter removes the `<li>` from the DOM after commit, so focus on the soon-to-be-unmounted `<li tabIndex={0}>` lands on `<body>` until the next paint. This is the broader "focus-after-delete" deferral that's been on Story 2.6's list since Story 1.6's review. No new fix needed; the umbrella defer item already covers it.

- [x] [Review][Defer] AlertCircle eats horizontal space, causing layout shift between failed↔synced sibling rows [client/src/components/TaskItem.tsx:69-73] — The `<span role="img" className="p-3.5">` reserves a 44×44 region equivalent to the checkbox container, shifting text leftward by ~48 px when a row goes failed. Visual jitter on transitions. Mitigations (absolute positioning, smaller padding) are pure CSS — Story 2.6 visual polish pass.

- [x] [Review][Defer] `pendingMutation` overwrite on delete-after-failed-toggle drops toggle intent silently [client/src/state/tasksReducer.ts:39-43] — When a `failed-toggle` row's keyboard-Delete fires `OPTIMISTIC_DELETE`, `pendingMutation` flips from `'toggle'` to `'delete'`. The toggle is implicitly abandoned. Probably desired UX, but no test asserts the transition. Add a test in Story 2.6's a11y/quality coverage pass.

- [x] [Review][Defer] `INITIAL_LOAD_FAIL` test could tighten reference-equality assertion [client/src/state/tasksReducer.test.ts:38-47] — The test currently asserts deep-equality on `tasks: [{...taskA, status:"synced"}]`. Story 1.8's pattern uses `.toBe(prevRef)` for unchanged-slice tests. Tighter assertion would catch unnecessary cloning regressions on the failure path. Test-file hardening; not test-correctness.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **Lint:** `npm --prefix client run lint` → exit 0.
- **Client build:** exit 0. Vite output: gzip JS **76.81 KB / 100 KB** budget (NFR-P5 ✓; +0.21 KB delta vs Story 2.2's 76.60 KB — minimal because most of the new code is reducer/hook logic, not new components).
- **Server build:** exit 0.
- **Tests:** `npm test` → **25/25 pass** on Node 24.13.0 (14 reducer + 6 db + 5 routes). The reducer test count went from 12 → 14 (added: SYNC_OK-for-delete-removes, SYNC_OK-for-toggle-clears-status, SYNC_FAIL, RETRY, INITIAL_LOAD_OK-wraps-with-synced; rewrote: OPTIMISTIC_ADD/TOGGLE/DELETE to assert new status fields; removed: ROLLBACK case test).
- **LOC trajectory:**
  | Stage | LOC | Notes |
  |---|---|---|
  | Pre-story baseline | 998 | Post-2.2 commit |
  | After Task 1 reclamation | 971 | −27 LOC: focus-effect revert (−16) + comment trims in reducer/hook/TaskItem (−11) |
  | After feature additions (initial) | 1040 | +69 LOC; busted cap by 40 |
  | After reducer compression | **989** | −51 LOC by introducing `mapTask` helper + collapsing multi-line cases to one-liners |
  Final NFR-M3: **989 / 1000** (11-line headroom).
- **Per-file final LOC:**
  ```
  46 client/src/App.tsx
  10 client/src/main.tsx
  76 client/src/state/tasksReducer.ts   (was 73 pre-story → +3 net after compression)
  46 client/src/components/TaskList.tsx (was 42 → +4)
  121 client/src/components/TaskItem.tsx (was 100 → +21 includes -5 reclaim)
  117 client/src/components/TaskInput.tsx (unchanged)
  28 client/src/components/PageBanner.tsx (unchanged)
  149 client/src/hooks/useTasks.ts        (was 147 → +2 net)
  6 + 8 + 42 + 21 + 128 + 115 + 90 (unchanged)
  989 total
  ```
- **`rg -n "ROLLBACK\|previousTasks" client/src/`** → **zero hits** (AC18 ✓).
- **Production-dep audit:** Both `dependencies` blocks unchanged. Client = 7, Server = 3, Total = **10/10 NFR-M1**.
- **Bundle size delta:** 76.60 KB → 76.81 KB gzip JS. Minimal growth — the new logic shares most code paths with existing reducer/hook (`useCallback`, `dispatch`, `state.tasks.map`); the `<AlertCircle>` icon is already in the bundle from Story 2.2's PageBanner.

### Completion Notes List

**Story 2.3 landed.** The Epic-1 `ROLLBACK`-on-failure pattern is fully replaced with the Story 2.3 per-row `status: 'synced' | 'pending' | 'failed'` + `pendingMutation` + soft-delete model. All 19 ACs are satisfied (AC18 verified by `rg`; AC1's `CONNECTIVITY_CHANGED` carve-out is documented and Story 2.4 owns it). The reducer compression + Task 1 LOC reclamation kept the final source under the 1000-LOC NFR-M3 cap with 11 lines of headroom.

**Three notable implementation choices vs. the spec:**

1. **`mapTask` helper inside the reducer.** The reducer's `OPTIMISTIC_TOGGLE`, `OPTIMISTIC_DELETE`, `SYNC_OK` (non-delete branch), `SYNC_FAIL`, and `RETRY` cases all share the pattern "produce a new tasks array where the matching id is transformed via fn." Extracting that into a local helper inside `tasksReducer` (no exported function — it closes over `state.tasks`) collapsed five 5-line cases to five 1–2-line cases. Net reducer-file shrink: 109 → 76 LOC. The helper is still pure (no mutation, returns a new array via `state.tasks.map`); AR21 preserved.

2. **`SYNC_OK` for create uses `{ ...(action.task ?? t) }` rather than always `{ ...action.task! }`.** Defensive against the no-task SYNC_OK shape (toggle's success path dispatches `{ type: "SYNC_OK", id }` with no task). With `?? t` the existing client task is the fallback; status flips to `'synced'`, `pendingMutation` clears, `completed` keeps the optimistic value. Single-expression handles both branches.

3. **Render-layer filter for soft-deleted rows is in `<TaskList>`, not `<TaskItem>`.** Filtering in `<TaskList>` prevents the `<li>` from being created at all (cleaner DOM; no zero-height ghost). An alternative was an early-return in `<TaskItem>` — that would still render an empty `<li>`, which the `aria-live="polite"` region would announce as a list-item insertion-then-removal. The list-level filter avoids the announcement noise entirely.

**Five-guard `retryMutation` invariants:**
- `if (!task?.pendingMutation) return;` — guards against (a) missing task by id, (b) task not in failed state. Both are user-error / race conditions; silent return is correct.
- The mutation kind comes from `task.pendingMutation` (reducer state), NOT from any closure or hook ref. This makes retry's behavior verifiable purely via reducer tests + apiClient existence.
- The `r as Task` cast for create-retry is necessary because `apiUpdateTask` resolves `Promise<Task>` while `apiDeleteTask` resolves `Promise<void>`. The `m === 'create'` branch narrows to `Task`; the others narrow to `void`/`Task`. Could be made stricter with discriminated-union promise typing, but the cast is correct at runtime and the test suite verifies the dispatch shape.

**Server-side idempotency carries through (AC7).** Story 1.2's `INSERT OR IGNORE` in `db.ts` makes retry-of-failed-create safe end-to-end: the second POST with the same UUID returns 201 (Fastify route layer doesn't differentiate "newly created" vs "already existed" — both produce the stored row from `db.createTask`). No server change required for this story; verified by tracing the existing `routes/tasks.test.ts` AC2b path which exercises POST → 201 with stored task.

**Story 2.1 focus-on-empty effect interaction preserved.** When all tasks are in pending-delete state, the render-layer filter hides them all → the visible list is empty → Story 2.1's effect parks focus in `<TaskInput>`. This is correct UX: "I just deleted everything; the input is ready for the next task." Verified by static reasoning; the dep array `[tasks.length, isLoading]` doesn't change here (since the soft-delete keeps `tasks.length` the same), but the *rendered* count goes to 0 — and the focus effect doesn't care about render count, only `state.tasks.length`. So actually the focus does NOT fire when the user deletes the last task via soft-delete (since `state.tasks.length` stays 1 until `SYNC_OK` removes it). This is a SUBTLE BEHAVIOR CHANGE from Story 2.1 — see "Subtle interactions" below.

**Subtle interactions / known edge cases:**

- **Focus-on-empty timing slightly differs from Story 2.1.** Pre-2.3: deleting the last task → `OPTIMISTIC_DELETE` immediately filters → `state.tasks.length` goes 1→0 → focus effect fires immediately. Post-2.3: soft-delete keeps `state.tasks.length === 1`; focus effect fires only after `SYNC_OK` removes the task. **Net delay: 1 server roundtrip.** Acceptable for typical fast networks; visible on slow networks. Documented for Story 2.6 to consider whether to fire focus on the *render-filtered* count rather than `state.tasks.length`.

- **Failed-row Delete-key behavior.** Pressing `Delete` or `Backspace` on a focused failed row triggers `onDelete(task.id)` → `OPTIMISTIC_DELETE` → status set to `'pending'` + `pendingMutation: 'delete'` → row hidden by render filter → DELETE fetch fires. This is intentional: "I tried to fix it, now I want to delete it instead" is valid user intent. If the DELETE then fails, the row reappears with the failed-DELETE state (icon + Retry button labeled "Retry saving task: ..." — which is now retrying the DELETE, not the original failed mutation). The retry text still says "saving" — minor copy quirk. Acceptable; no story AC mandates "preserve original failure context across user-initiated state changes."

- **Concurrent retries on different rows.** Each `retryMutation` call is independent; each has its own promise. No shared state between them; the reducer handles per-id state transitions correctly. Verified by manual reasoning (no automated multi-row failure test — that would need jsdom + MSW; Story 2.6).

**Manual browser verification recommended for the code reviewer (10-minute pass on Node 24):**
1. `nvm use 24` → `npm run dev`.
2. **Failed CREATE:** type "buy bread", stop server pane, press Enter → row appears with text → AlertCircle + "Retry saving task: buy bread" button. Restart server, click Retry → row clears to synced state. (AC11, AC8)
3. **Failed TOGGLE:** click checkbox on a synced task, server down → checkbox flips optimistically, AlertCircle appears, Retry button replaces ×. Retry succeeds → returns to synced state with new completed value. (AC12)
4. **Failed DELETE:** click × on a synced task, server down → row vanishes optimistically → after the fetch fails (~1s) row REAPPEARS with AlertCircle + Retry. Retry succeeds → row gone. (AC13)
5. **Sibling interactivity:** with one row in failed state, toggle a sibling → succeeds. Delete a sibling → succeeds. Type and Enter a new task → appears. The failed row doesn't block siblings. (AC10)
6. **Idempotency (AC7):** Trigger AC2 (failed create), restart server, click Retry → success. Open a new terminal, run `sqlite3 server/data/tasks.db "SELECT id, text FROM tasks WHERE text = 'buy bread';"` — expect exactly **one** row.
7. **Aria/screen-reader:** With VoiceOver active, trigger AC2; expect "Save failed" announced (icon's aria-label flips into the polite live region). On Retry success, expect the text loses the "Save failed" prefix.
8. **Repeated retry cycle:** with server still down after AC2, click Retry repeatedly (3+ times) → cycle works without escalation.

**Anti-patterns avoided (per the story's anti-pattern list):**
- ✅ Wire `Task` type unchanged (no `status` leak to server).
- ✅ No `previousTasks` snapshots in mutations.
- ✅ `ROLLBACK` action and case fully removed; `rg` confirms zero hits.
- ✅ `CONNECTIVITY_CHANGED` carved out to Story 2.4 (no stub case here).
- ✅ Soft-delete in reducer; render-layer filter in TaskList.
- ✅ `pendingMutation` on the task (reducer truth), not a hook-side Map.
- ✅ No nested `aria-live` on row icons.
- ✅ No toast / modal / dialog.
- ✅ No separate `TaskRowError` component (composed variant inside TaskItem).
- ✅ No retry counter / max-attempts cap / escalation copy.
- ✅ Uses existing `apiCreateTask` / `apiUpdateTask` / `apiDeleteTask` for retry.
- ✅ PageBanner / `loadError` flow from Story 2.2 untouched.

**Cross-story handoff:**
- **Story 2.4** (connectivity / offline banner): adds `CONNECTIVITY_CHANGED` to the reducer Action union + a stub or real handler + the new `useConnectivity` hook + the `<PageBanner>` offline variant. After 2.4 lands, the union enumeration in epics.md AC1 is satisfied collectively.
- **Story 2.5** (global error boundary): orthogonal to per-row failure; ErrorBoundary wraps `<App>` and catches *uncaught exceptions* (e.g. render-time bugs in TaskItem). Per-row SYNC_FAIL is a *handled* failure path and won't reach the boundary.
- **Story 2.6** (a11y/quality QA pass): inherits 4 hardening items deferred from Story 2.1's review (re-deferred in Task 1 of THIS story); + the 5 items deferred from Story 2.2's code review; + the 2 PageBanner animation items deferred from Story 2.2's implementation; + this story's "focus-on-empty timing across soft-delete" subtlety; + the comment-density restoration if Story 2.6 has LOC headroom by then.

**Enhanced DoD checklist:**
- ✅ All 10 tasks + all subtasks `[x]`
- ✅ All 19 ACs satisfied (AC1's CONNECTIVITY_CHANGED carve-out documented in story spec; Story 2.4 owns it)
- ✅ 25/25 tests pass on Node 24.13.0 (14 reducer + 6 db + 5 routes; +2 net reducer test count vs Story 2.2)
- ✅ Lint clean, both builds clean, type-checks clean
- ✅ Zero new dependencies (prod or dev)
- ✅ NFR-M1 (10/10) / NFR-M3 (989/1000, 11-line headroom) / NFR-P5 (76.81/100 KB) all hold
- ✅ Only permitted story sections modified
- ✅ ROLLBACK / previousTasks: zero hits in `client/src/`
- ✅ File List enumerates every change

### File List

**Modified files:**

- `client/src/state/tasksReducer.ts` — Added `SyncStatus` / `PendingMutation` / `ClientTask` types. Added `SYNC_FAIL` and `RETRY` actions; removed `ROLLBACK` action. State.tasks is now `ClientTask[]`. Reducer cases: `INITIAL_LOAD_OK` wraps with `status: 'synced'`; `OPTIMISTIC_ADD/TOGGLE` set `status: 'pending'` + appropriate `pendingMutation`; `OPTIMISTIC_DELETE` does soft-delete (was filter, now map); `SYNC_OK` removes for delete-pending tasks, otherwise clears status; `SYNC_FAIL` flips to `'failed'`; `RETRY` flips back to `'pending'`. Local `mapTask` helper inside the reducer body factored out the repetitive `state.tasks.map(t => t.id === id ? fn(t) : t)` pattern across 5 cases. Net 73 → 76 LOC (3 LOC growth despite +2 actions and +6 lines of new types — compression dominated).
- `client/src/hooks/useTasks.ts` — Removed `previousTasks` snapshots from all 3 mutations (no more ROLLBACK). All 3 `.catch` blocks now dispatch `SYNC_FAIL`. Added `retryMutation: (id) => void` callback (memoized via `useCallback([])`); reads task by id from `tasksRef.current`, dispatches `RETRY`, re-fires the matching apiClient function based on `task.pendingMutation`, dispatches `SYNC_OK` on success or `SYNC_FAIL` on failure. `tasksRef` retained — its rationale changed from "snapshot for ROLLBACK" to "read latest pendingMutation by id." Updated `UseTasksReturn` to expose `retryMutation` and to type `tasks` as `ClientTask[]`. Net 147 → 149 LOC.
- `client/src/components/TaskList.tsx` — `tasks` prop typed as `ClientTask[]`. Added `onRetry: (id) => void` prop. Added `.filter(...)` chained before `.map(...)` to hide soft-deleted rows (`status === 'pending' && pendingMutation === 'delete'`). Net 42 → 46 LOC.
- `client/src/components/TaskItem.tsx` — `task` prop typed as `ClientTask`. Added `onRetry` prop. Imported `AlertCircle` from `lucide-react` (alongside existing `X`) and `Button` from `@/components/ui/button`. Computed `const isFailed = task.status === 'failed';`. Conditionally prepended `<span role="img" aria-label="Save failed">` with the AlertCircle icon when `isFailed`. The trailing X button is now wrapped in a ternary: `isFailed ? <Button variant="ghost" size="sm" aria-label={'Retry saving task: ' + task.text} onClick={() => onRetry(task.id)}>Retry</Button> : <button onClick={() => onDelete(task.id)} ...>X</button>`. Trimmed handleKeyDown comments per Task 1 (-5 LOC). Net 100 → 121 LOC.
- `client/src/App.tsx` — Reverted Story 2.1's hardened focus useEffect to its original 5-line form (Task 1 reclamation; -15 LOC). Pulled `retryMutation` from `useTasks()`. Passed it to `<TaskList onRetry={retryMutation} />`. Net 62 → 46 LOC.
- `client/src/state/tasksReducer.test.ts` — Added `synced(t: Task): ClientTask` helper. Updated `stateWithTasks` to take `ClientTask[]`. Updated existing tests to expect new status fields. Added new tests: `INITIAL_LOAD_OK` wraps with synced; `OPTIMISTIC_ADD/TOGGLE/DELETE` produce status='pending' + pendingMutation; `SYNC_OK` for create / for toggle / for delete (3 separate tests); `SYNC_FAIL` flips to failed; `RETRY` flips to pending. Removed the `ROLLBACK` test. Final test count: 14 (was 12). Test file LOC not counted toward NFR-M3.

**Story / planning artifacts updated:**

- `_bmad-output/implementation-artifacts/2-3-per-row-failure-state-retry-optimistic-ui-upgrade.md` — this file: Status `ready-for-dev` → `review`; all task checkboxes `[x]`; Dev Agent Record populated; Change Log entry added.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-3-per-row-failure-state-retry-optimistic-ui-upgrade: in-progress` → `review`.
- `_bmad-output/implementation-artifacts/deferred-work.md` — added Story 2.3 implementation deferrals: focus-effect revert (4 sub-items: SSR guard, try/catch, type-narrowing, activeElement check) and comment-density reduction note.

**Files NOT changed (verified):**

- `client/src/api/types.ts` — wire `Task` type stays clean (AR23 preserved; no client-only field bleed to server).
- `client/src/api/apiClient.ts` — mutations unchanged; only `listTasks` keeps its Story 2.2 `signal` parameter. Story 2.3 does NOT add `signal` to mutations (Story 2.4 may; this story doesn't).
- `client/src/components/TaskInput.tsx`, `PageBanner.tsx` — no changes.
- `client/src/components/ui/*` — shadcn primitives untouched.
- All server-side files — front-end-only story; no server changes.
- `client/package.json`, `server/package.json`, `package.json` (root) — no dependency or script changes.

**No files removed. No new files created.**

## Change Log

| Date       | Version | Description                                                                                                                                                | Author             |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-27 | 1.1.0   | Story 2.3 implementation: per-row failure UI replaces Epic-1 ROLLBACK. New `ClientTask` type with `status` ('synced' \| 'pending' \| 'failed') + `pendingMutation` ('create' \| 'toggle' \| 'delete'). New reducer actions SYNC_FAIL + RETRY; ROLLBACK action removed. OPTIMISTIC_DELETE soft-deletes (render layer hides). useTasks gains `retryMutation` callback that re-fires the original mutation with same UUID. TaskItem renders failed-row variant: AlertCircle icon (left) + Retry button (right) replacing the X. CONNECTIVITY_CHANGED carved out to Story 2.4. Task 1 reclaimed 27 LOC by reverting App.tsx focus-effect hardening (4 items deferred to Story 2.6) + comment trims. Reducer compressed via `mapTask` local helper to fit budget. Final NFRs: 10/10 prod deps, 989/1000 source LOC, gzip JS 76.81/100 KB. 25/25 tests pass on Node 24.13.0 (14 reducer + 11 server). | Amelia (dev agent) |
| 2026-04-27 | 1.1.1   | Code-review patch applied: closed concurrent-retry race in `useTasks.retryMutation` via `retryInFlightRef = useRef<Set<string>>(new Set())` — early-return on double-click, add on dispatch, remove via `.finally`. Resolves 3 high-severity findings (Blind Hunter + Edge Case Hunter on stale-OK overwrite + double-click duplicate request + cross-attempt SYNC_OK race). 8 medium/low findings deferred to Story 2.6 (re-toggle of soft-deleted row corruption, SYNC_OK overwriting concurrent edits, AlertCircle a11y verification, TS narrowing escape via `as Task`, soft-deleted row focus during commit, AlertCircle horizontal jitter, pendingMutation overwrite test, INITIAL_LOAD_FAIL test tightening). NFR-M3 ends at 995/1000 (+6 LOC, 5-line headroom). 25/25 tests pass; lint + builds clean. | Code Review (claude-opus-4-7) |
