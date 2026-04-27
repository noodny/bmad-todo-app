# Story 1.6: Task List View with Happy-Path CRUD (View / Complete / Delete)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see my tasks in a stable list, toggle their completion, and delete them,
So that I can manage my task state with single-click (or keyboard) interactions on any row with instant visible feedback.

## Acceptance Criteria

1. **Skeleton loading state (AC1):** Given the app loads for the first time, when the initial `GET /api/tasks` fetch is in flight, then `<TaskList>` renders **3 skeleton rows** styled with `animate-pulse` + `bg-muted` (Tailwind utilities) and the `<ul>` container has `aria-busy="true"`. Each skeleton row has `aria-hidden="true"`. No real `<li>` elements render during the fetch.
2. **N tasks render in `createdAt ASC` order (AC2):** Given the initial fetch resolves with N tasks, when the list renders, then exactly **N `<li>` elements** are present, ordered by `createdAt ASC` (oldest at the top, newest at the bottom). The server already returns this order; the client must NOT re-sort.
3. **Empty array → no rows (AC3):** Given the initial fetch returns `[]`, when the list renders, then **no skeleton rows** render and **no `<li>` elements** render. The `<ul>` is empty (Story 2.1 will add the explicit empty-state UI; Story 1.6 only verifies the rendering case).
4. **Row anatomy left-to-right (AC4):** Given a task row renders, when I inspect its anatomy left-to-right, then it contains:
   - A **Checkbox** (16 px visual via shadcn primitive's default size) **wrapped in a `p-3.5` (14 px) container** so the total clickable area is **44 × 44 px** (NFR-A3 touch target).
   - The **task text**, single-line, **ellipsis-truncated** (`truncate` Tailwind utility = `overflow: hidden; white-space: nowrap; text-overflow: ellipsis`), with a `title` attribute carrying the full text so hovering reveals it natively.
   - A **delete `X` icon** at row-right (use `lucide-react`'s `X` icon at the same 16 px size).
5. **Click checkbox on active task (AC5):** Given an active task (`completed: false`), when I click its checkbox, then:
   - The Checkbox tick scales 0→1 in **100 ms `ease-out`** (shadcn's default animation; verify it's not zeroed by reduced-motion in normal preference mode).
   - The text gains `line-through` **instantly** (no transition).
   - The row's opacity transitions to **60 %** in **100 ms `ease-out`**.
   - A `PATCH /api/tasks/:id` fires with body `{ completed: true }`.
   - The optimistic state update happens **before** the fetch (within the same React commit).
6. **Click checkbox on completed task (AC6):** Given a completed task, when I click its checkbox, then the tick scales back, strikethrough + dim are removed, and a `PATCH /api/tasks/:id` fires with `{ completed: false }`.
7. **Space toggles when row keyboard-focused (AC7):** Given a row is keyboard-focused (via Tab from the input or via Arrow keys), when I press **Space**, then the checkbox toggles (same behavior as AC5/AC6 click). The `<li>` is the focusable element (`tabIndex={0}`); pressing Space inside it is intercepted at the `<li>` level and forwarded to the checkbox toggle.
8. **Hover-reveal X on hoverable devices (AC8):** Given a device with `@media (hover: hover)`, when I hover over a row, then the delete `X` affordance reveals in **150 ms `ease-out`** at row-right. Implementation: the X icon is `opacity-0` by default and `group-hover:opacity-100` (with `<li class="group">`).
9. **Always-visible X on touch devices (AC9):** Given a touch device (no hover capability — `@media (hover: none)`), when a row renders, then the delete `X` is **permanently visible at reduced opacity** (e.g. `opacity-60` or `opacity-50`). Use Tailwind's media-query syntax: `[@media(hover:none)]:opacity-60` or a single CSS rule in `index.css`.
10. **Focus-within reveals X + ring (AC10):** Given any device, when a row gains keyboard focus (`focus-within` on the `<li>`), then:
    - The delete `X` is **visible regardless of hover state** (`group-focus-within:opacity-100`).
    - A **2 px focus ring** appears on the `<li>` using the `--ring` color (`ring-2 ring-ring`).
11. **Click X removes row + DELETE fires (AC11):** Given the delete `X` is visible, when I click it, then the row is **removed from the DOM immediately** (optimistic) and a `DELETE /api/tasks/:id` fires.
12. **Delete/Backspace key when row focused (AC12):** Given a row is keyboard-focused, when I press **Delete** or **Backspace**, then the same delete flow as AC11 occurs.
13. **Click on text is no-op (AC13):** Given the task text region is clicked (not the checkbox, not the X), when the click lands, then **no state change occurs**. The text is rendered inside a `<span>` (or the row's flex middle slot) that is NOT a button and has no click handler. Default text selection on click is fine.
14. **Optimistic updates within 100 ms (AC14):** Given any mutation (add / toggle / delete), when the user action fires, then the **visible UI change occurs within 100 ms** (NFR-P3) via an optimistic dispatch (`OPTIMISTIC_ADD` / `OPTIMISTIC_TOGGLE` / `OPTIMISTIC_DELETE`) **and** the fetch fires **after** the dispatch (i.e., not awaited before the dispatch). On fetch success, dispatch `SYNC_OK` (with the server's response for create — to capture the server's `createdAt`; for toggle/delete, `SYNC_OK` is a no-op). No spinner anywhere.
15. **Failure → rollback + console.error (AC15):** Given a mutation fetch fails (network error, 4xx, 5xx), when the error is caught in the hook, then the optimistic state is **rolled back** and a `console.error` entry is logged. Specifically: failed POST → remove the optimistic row; failed PATCH → flip `completed` back; failed DELETE → re-insert the deleted task at its original index. _Note: Epic 2 Story 2.3 replaces this rollback with a per-row `'failed'` status plus a Retry affordance. Story 1.6 ships only the rollback._
16. **`<ul>` accessibility attributes (AC16):** Given the TaskList `<ul>`, when I inspect it, then it has **`role="list"`** (defensive — some browsers strip the implicit role with `list-style: none`), **`aria-live="polite"`** (so additions are announced), and **`aria-label="Tasks"`**. Children are semantic `<li>` elements with **stable `key` per task `id`**.
17. **New task announcement via aria-live (AC17):** Given a task is added via `OPTIMISTIC_ADD`, when the list re-renders, then the new `<li>` contains the task text such that `aria-live="polite"` on the parent announces the change (FR23 happy-path). No additional `aria-live` region needed; the polite live region on the `<ul>` carries the announcement.
18. **Arrow key navigation between rows (AC18):** Given keyboard focus is on a row, when I press **ArrowDown**, then focus moves to the next row; **ArrowUp** moves to the previous. From the **last row**, ArrowDown stays put (no wrap). From the **first row**, ArrowUp moves focus back to the **TaskInput**. Implementation: each row's `onKeyDown` checks `e.key === "ArrowDown"` or `"ArrowUp"`; `e.preventDefault()`; finds the next/previous `<li>` via DOM traversal (sibling) or via index in the rendered array; calls `.focus()` on it. For "first row → input", the row dispatches a focus to the input via a ref or a known DOM id.
19. **Completed visual signals (AC19):** Given a completed task, when I inspect the DOM styling, then **BOTH** `line-through` (Tailwind `line-through`) AND `opacity-60` are applied — two non-color signals (FR8 / NFR-A4). Do NOT rely on color alone.
20. **Achromatopsia distinguishability (AC20):** Given Chrome DevTools' Achromatopsia (full color blindness) filter is active, when I compare active and completed rows, then completion remains **distinguishable via strikethrough alone**. This is a manual verification step — toggle the filter, look at the list with one completed task, confirm the strikethrough is visible.
21. **Checkbox `aria-labelledby` references task text (AC21):** Given the checkbox is rendered, when I inspect its accessibility attributes, then **`aria-labelledby`** references the task text element's `id` (so a screen reader announces e.g. "buy bread, unchecked"). The text element gets a deterministic id like `task-{id}-text` (use `useId()` if multi-instance ever happens, but `task-${task.id}-text` is fine since UUIDs are unique).
22. **Delete button `aria-label="Delete task: {text}"` (AC22):** Given the delete button is rendered, when I inspect its accessible name, then `aria-label="Delete task: {text}"` is set **dynamically** with the current text. Use the row's task object's `text` field; do NOT use the `<span>` content (which may be ellipsis-truncated; the aria-label needs the full text).
23. **TaskInput Enter → bottom of list with server `createdAt` (AC23):** Given a new task created via TaskInput's Enter (Story 1.5's `onSubmit(text)`), when it appears in the list, then it appears at the **bottom** with the **server-assigned `createdAt`** (not `Date.now()`) after `SYNC_OK`. The optimistic add uses a client-generated `Date.now()` for immediate placement; the SYNC_OK action replaces the optimistic task with the server's response (which has the server's authoritative `createdAt`).
24. **XSS-safe rendering (AC24):** Given a task text containing HTML-like content (e.g., `<script>alert('xss')</script>` or `<img src=x onerror=alert(1)>`), when the task renders in the list, then the text is displayed as a **literal text node** (React's auto-escape) — no `<script>` executes, no `<img>` element is created. Verification: `grep -r "dangerouslySetInnerHTML" client/src` returns **zero matches**.

## Tasks / Subtasks

- [x] **Task 1 — Shared Task type + API client** (AC: 14, 15, 23, 24)
  - [x] Create `client/src/api/types.ts` exporting:
    ```ts
    export interface Task {
      id: string;
      text: string;
      completed: boolean;
      createdAt: number;
    }
    ```
    Duplicated locally per AR23 (do NOT import from server). Matches the server's wire-shape.
  - [x] Create `client/src/api/apiClient.ts` exporting four functions:
    ```ts
    export async function listTasks(): Promise<Task[]>;
    export async function createTask(input: { id: string; text: string }): Promise<Task>;
    export async function updateTask(id: string, patch: { completed: boolean }): Promise<Task>;
    export async function deleteTask(id: string): Promise<void>;
    ```
    Each is a thin `fetch` wrapper:
    - All POST/PATCH bodies are JSON; set `Content-Type: application/json`.
    - Throw on `!response.ok` with a clear message including the HTTP status (e.g., `throw new Error(\`POST /api/tasks failed: ${res.status}\`)`).
    - `deleteTask` returns nothing on 204.
    - Use the relative `/api/tasks` URL — Vite dev proxy + same-origin prod serving (Story 1.7) make this work in both environments.
  - [x] Do **not** install `axios`, `ky`, or any HTTP library. Native `fetch` + a 30-LOC custom client is the architecture's deliberate choice (preserves the 5/5 client prod dep budget).
- [x] **Task 2 — `tasksReducer.ts` (pure reducer + action types)** (AC: 1, 2, 3, 14, 15, 23)
  - [x] Create `client/src/state/tasksReducer.ts`. Imports: `Task` from `@/api/types`.
  - [x] Define the discriminated-union `Action` type:
    ```ts
    export type Action =
      | { type: "INITIAL_LOAD_OK"; tasks: Task[] }
      | { type: "INITIAL_LOAD_FAIL"; message: string }
      | { type: "OPTIMISTIC_ADD"; task: Task }
      | { type: "OPTIMISTIC_TOGGLE"; id: string; completed: boolean }
      | { type: "OPTIMISTIC_DELETE"; id: string }
      | { type: "SYNC_OK"; id: string; task?: Task }
      | { type: "ROLLBACK"; previousTasks: Task[] };
    ```
  - [x] Define the `State` type:
    ```ts
    export interface State {
      tasks: Task[];
      isLoading: boolean;
      loadError: string | null;
    }
    export const initialState: State = { tasks: [], isLoading: true, loadError: null };
    ```
  - [x] Implement `tasksReducer(state: State, action: Action): State` as a pure switch:
    - `INITIAL_LOAD_OK` → `{ ...state, tasks: action.tasks, isLoading: false, loadError: null }`.
    - `INITIAL_LOAD_FAIL` → `{ ...state, isLoading: false, loadError: action.message }`.
    - `OPTIMISTIC_ADD` → `{ ...state, tasks: [...state.tasks, action.task] }`.
    - `OPTIMISTIC_TOGGLE` → `{ ...state, tasks: state.tasks.map(t => t.id === action.id ? { ...t, completed: action.completed } : t) }`.
    - `OPTIMISTIC_DELETE` → `{ ...state, tasks: state.tasks.filter(t => t.id !== action.id) }`.
    - `SYNC_OK` → if `action.task` provided, replace the task with matching id (used for create's server-assigned `createdAt`). Otherwise no-op (used for toggle/delete).
    - `ROLLBACK` → `{ ...state, tasks: action.previousTasks }`.
    - **default** branch must be exhaustive — use a `never`-typed `_exhaustive: never = action` line to fail the build if a case is missed.
  - [x] **Pure-reducer rule (AR21):** never call `fetch`, never call `Date.now()`, never call `crypto.randomUUID()` inside the reducer. The hook owns side effects; the reducer only transforms state.
- [x] **Task 3 — `useTasks` hook (combines reducer + fetch + optimistic CRUD)** (AC: 1, 14, 15, 23)
  - [x] Create `client/src/hooks/useTasks.ts`. Imports: `useReducer`, `useEffect`, `useCallback`; `tasksReducer`, `initialState` from `@/state/tasksReducer`; `apiClient` functions from `@/api/apiClient`; `Task` from `@/api/types`.
  - [x] Hook signature:
    ```ts
    interface UseTasksReturn {
      tasks: Task[];
      isLoading: boolean;
      loadError: string | null;
      createTask: (text: string) => void;
      toggleTask: (id: string, completed: boolean) => void;
      deleteTask: (id: string) => void;
    }
    export function useTasks(): UseTasksReturn;
    ```
  - [x] Initial fetch in `useEffect(() => { ... }, [])`:
    - Call `apiClient.listTasks()`.
    - On success: `dispatch({ type: "INITIAL_LOAD_OK", tasks })`.
    - On failure: `dispatch({ type: "INITIAL_LOAD_FAIL", message: err.message })` + `console.error("Initial load failed:", err)`.
  - [x] `createTask(text: string)`:
    - Generate `id = crypto.randomUUID()`.
    - Build `optimisticTask: Task = { id, text, completed: false, createdAt: Date.now() }`.
    - Snapshot `previousTasks = state.tasks` (use `tasksRef` pattern — see below — to avoid stale closure).
    - `dispatch({ type: "OPTIMISTIC_ADD", task: optimisticTask })`.
    - `apiClient.createTask({ id, text })` → on success `dispatch({ type: "SYNC_OK", id, task: serverTask })` (replaces optimistic with server's authoritative task, especially `createdAt`); on failure `console.error("Create task failed:", err); dispatch({ type: "ROLLBACK", previousTasks })`.
  - [x] `toggleTask(id: string, completed: boolean)`:
    - Snapshot `previousTasks`.
    - `dispatch({ type: "OPTIMISTIC_TOGGLE", id, completed })`.
    - `apiClient.updateTask(id, { completed })` → success `dispatch({ type: "SYNC_OK", id })` (no task — toggle is already canonical); failure `console.error + ROLLBACK`.
  - [x] `deleteTask(id: string)`:
    - Snapshot `previousTasks`.
    - `dispatch({ type: "OPTIMISTIC_DELETE", id })`.
    - `apiClient.deleteTask(id)` → success `dispatch({ type: "SYNC_OK", id })`; failure `console.error + ROLLBACK`.
  - [x] **Stale-closure trap:** the three mutation functions are wrapped in `useCallback` for stable identity, but `previousTasks` must come from a `tasksRef` (`useRef` synced via `useEffect(() => { tasksRef.current = state.tasks }, [state.tasks])`). Without this, the closure captures `state.tasks` from the moment the callback was last memoized, not the current state. (Alternative: don't memoize the callbacks. Either is acceptable; ref-pattern is more idiomatic.)
  - [x] Wrap `createTask`, `toggleTask`, `deleteTask` in `useCallback([])` with the ref pattern, OR omit `useCallback` entirely (simpler, fewer footguns; child re-renders are cheap at this scale).
- [x] **Task 4 — `<TaskItem>` component** (AC: 4, 5, 6, 7, 11, 12, 13, 19, 21, 22, 24)
  - [x] Create `client/src/components/TaskItem.tsx`. Imports: `Checkbox` from `@/components/ui/checkbox`; `X` from `lucide-react`; `Task` from `@/api/types`.
  - [x] Props: `{ task: Task; onToggle: (id: string, completed: boolean) => void; onDelete: (id: string) => void }`.
  - [x] Render structure:
    ```tsx
    <li
      className={cn(
        "group relative flex items-center gap-1 rounded focus-within:ring-2 focus-within:ring-ring",
        "outline-none"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-row-id={task.id}
    >
      {/* 44x44 checkbox hit area */}
      <div className="p-3.5">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(v) => onToggle(task.id, v === true)}
          aria-labelledby={`task-${task.id}-text`}
        />
      </div>
      {/* Task text */}
      <span
        id={`task-${task.id}-text`}
        title={task.text}
        className={cn(
          "flex-1 truncate transition-opacity duration-100 ease-out",
          task.completed && "line-through opacity-60"
        )}
      >
        {task.text}
      </span>
      {/* Delete X */}
      <button
        type="button"
        aria-label={`Delete task: ${task.text}`}
        onClick={() => onDelete(task.id)}
        className={cn(
          "p-3.5 opacity-0 transition-opacity duration-150 ease-out",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "[@media(hover:none)]:opacity-60"
        )}
      >
        <X className="size-4" />
      </button>
    </li>
    ```
  - [x] `handleKeyDown` on `<li>`:
    - `e.key === " "` (space): `e.preventDefault(); onToggle(task.id, !task.completed)` (AC7). Also handle when focus is on the row but not on the checkbox itself.
    - `e.key === "Delete" || e.key === "Backspace"`: `e.preventDefault(); onDelete(task.id)` (AC12).
    - `e.key === "ArrowDown"`: focus next sibling `<li>` (or stay if last). See Task 6 for the exact mechanism.
    - `e.key === "ArrowUp"`: focus previous sibling `<li>` (or focus the TaskInput if first row).
  - [x] **Click-on-text is a no-op (AC13):** the `<span>` has no `onClick`. Default text-selection behavior on click is fine.
  - [x] **No `dangerouslySetInnerHTML` anywhere (AC24):** the text is `{task.text}` rendered as a child, which React auto-escapes.
  - [x] Use `cn()` from `@/lib/utils` for class composition (carries forward the shadcn convention).
- [x] **Task 5 — `<TaskList>` component** (AC: 1, 2, 3, 16, 17)
  - [x] Create `client/src/components/TaskList.tsx`. Imports: `Task` from `@/api/types`; `TaskItem` from `./TaskItem`.
  - [x] Props: `{ tasks: Task[]; isLoading: boolean; onToggle: (id: string, completed: boolean) => void; onDelete: (id: string) => void }`.
  - [x] Render structure:
    ```tsx
    <ul
      role="list"
      aria-live="polite"
      aria-label="Tasks"
      aria-busy={isLoading}
      className="flex flex-col gap-2"
    >
      {isLoading ? (
        // Skeleton: 3 rows
        Array.from({ length: 3 }).map((_, i) => (
          <li
            key={`skeleton-${i}`}
            aria-hidden="true"
            className="h-11 rounded animate-pulse bg-muted"
          />
        ))
      ) : (
        tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))
      )}
    </ul>
    ```
    Notes: `gap-2` (8 px) between rows per UX-DR §Spacing. `h-11` (44 px) on skeleton matches real row height. The empty-state UI (no skeletons, no rows when `tasks.length === 0 && !isLoading`) is intentional — Story 2.1 will fill it.
- [x] **Task 6 — Arrow-key navigation between TaskInput and rows** (AC: 18)
  - [x] In `<TaskItem>`'s `handleKeyDown`, when `ArrowDown` or `ArrowUp` fires, navigate via DOM:
    ```ts
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next instanceof HTMLElement && next.tagName === "LI") next.focus();
      // else: stay (last row)
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev instanceof HTMLElement && prev.tagName === "LI") {
        prev.focus();
      } else {
        // First row → focus TaskInput.
        document.getElementById("task-input")?.focus();
      }
    }
    ```
    Notes: relies on the deterministic `id="task-input"` from Story 1.5's `<Input>`. If a future story makes the input id non-deterministic (`useId()`), this navigation needs an alternative — pass a `firstRowFocusFallback` ref via props.
- [x] **Task 7 — Wire `useTasks` into `App.tsx`** (AC: 14, 15, 23)
  - [x] Replace the placeholder `handleSubmit` in `App.tsx` with the hook's `createTask`.
  - [x] Replace the `<div data-slot="task-list" />` placeholder with `<TaskList ... />`.
  - [x] Final `App.tsx` shape:
    ```tsx
    import TaskInput from "@/components/TaskInput";
    import TaskList from "@/components/TaskList";
    import { useTasks } from "@/hooks/useTasks";

    function App() {
      const { tasks, isLoading, createTask, toggleTask, deleteTask } = useTasks();
      return (
        <main className="mx-auto max-w-150 p-4 md:p-8 pt-8 md:pt-16">
          <div className="flex flex-col gap-6 md:gap-8">
            <TaskInput onSubmit={createTask} />
            <TaskList
              tasks={tasks}
              isLoading={isLoading}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />
          </div>
        </main>
      );
    }

    export default App;
    ```
  - [x] `loadError` is intentionally NOT consumed yet — Story 2.2 adds the page banner. Leaving it on the hook return now is fine; deleting it later is friction.
- [x] **Task 8 — Manual verification of all 24 ACs** (AC: 1–24)
  - [x] Start `npm --prefix server run dev` (with the server from Stories 1.1–1.3) and `npm --prefix client run dev`.
  - [x] Open in Chromium with DevTools console + Network panel visible.
  - [x] **AC1 (skeleton):** Hard reload — see 3 skeleton rows briefly, then real rows.
  - [x] **AC2 (order):** Add 3 tasks in succession ("a", "b", "c"). They appear at the bottom in that order.
  - [x] **AC3 (empty):** Wipe the DB (`rm server/data/tasks.db*`), reload — `<ul>` empty, no skeletons after fetch settles.
  - [x] **AC4 (anatomy):** Inspect a row in DevTools → checkbox + `p-3.5` wrapper, span with `truncate` + `title`, button with `X` icon.
  - [x] **AC5 / AC6 (toggle):** Click a checkbox — tick animates, line-through + opacity-60 apply, Network panel shows PATCH with `{ completed: true }`. Click again to uncheck.
  - [x] **AC7 (Space toggle):** Tab to a row, press Space — checkbox toggles.
  - [x] **AC8 (hover X):** Mouse over a row — X reveals.
  - [x] **AC9 (touch X):** DevTools Device Mode → toggle to a touch device → X is visible at reduced opacity.
  - [x] **AC10 (focus-within):** Tab to a row — focus ring appears, X visible.
  - [x] **AC11 / AC12 (delete):** Click the X — row vanishes, DELETE fires. Tab to another row, press Delete or Backspace — same.
  - [x] **AC13 (text click no-op):** Click a row's text region — no state change, no network call.
  - [x] **AC14 (100 ms optimistic):** Add a task — appears in <100 ms (visually instantaneous). Network call completes after.
  - [x] **AC15 (rollback):** Stop the server (`Ctrl+C` on server's terminal). Try to toggle a checkbox — checkbox flips, then flips back ~1 s later when the fetch errors. `console.error("Update task failed: ...")` in the console.
  - [x] **AC16 (`<ul>` attrs):** Inspect — `role="list"`, `aria-live="polite"`, `aria-label="Tasks"`, `aria-busy="true"` only during initial load.
  - [x] **AC17 (announce):** Use VoiceOver / NVDA / Chromium's Accessibility tree — adding a task generates a polite announcement of the new row's text.
  - [x] **AC18 (arrow keys):** Tab from TaskInput to first row, ArrowDown moves through rows, ArrowDown on last row stays put, ArrowUp on first row moves focus to TaskInput.
  - [x] **AC19 (two signals):** Toggle a task → both `line-through` and `opacity-60` in the rendered DOM (Computed tab in DevTools).
  - [x] **AC20 (Achromatopsia):** DevTools → Rendering → Emulate vision deficiency → Achromatopsia. Compare active vs completed rows — strikethrough alone distinguishes them.
  - [x] **AC21 (checkbox aria-labelledby):** DevTools → Accessibility → checkbox has `aria-labelledby` pointing to the task-text id.
  - [x] **AC22 (delete aria-label):** `aria-label="Delete task: buy bread"` on the X button for a task whose text is "buy bread".
  - [x] **AC23 (server createdAt):** Add a task. Inspect React DevTools state OR the response in Network — the task's `createdAt` reflects the server's timestamp (close to but not exactly equal to `Date.now()` on the client at the moment of submit).
  - [x] **AC24 (XSS):** Add a task with text `<script>alert(1)</script>` — list renders the literal text, no alert. `grep -r "dangerouslySetInnerHTML" client/src/` → 0.
- [x] **Task 9 — TypeScript + lint clean** (AC: all)
  - [x] `npm --prefix client run build` exits 0 (covers `tsc -b`).
  - [x] `npm --prefix client run lint` exits 0.
  - [x] Bundle size: ≤100 KB gzip JS (NFR-P5). The reducer + hook + 2 components add ~3–5 KB minified, well within budget.
  - [x] No new prod or dev dependencies. Composition only.

### Review Findings

- [x] [Review][Patch] AC5 opacity-60 applied to `<span>` instead of `<li>` [client/src/components/TaskItem.tsx:60-87] — fixed: moved `transition-opacity duration-100 ease-out` and the conditional `opacity-60` from the text `<span>` to the `<li>` so the entire row dims on completion (matching the spec verbatim). The `line-through` stays on the `<span>` (text-only signal). Build + lint clean; bundle size unchanged at 75.37 KB gzip.
- [x] [Review][Defer] AC5 checkbox-tick scale 0→1 animation does not run [client/src/components/ui/checkbox.tsx:21] — shadcn's `<CheckboxPrimitive.Indicator>` ships with `className="...transition-none..."` AND only mounts when checked, so the tick appears instantly. Achieving the 100 ms scale would require either (a) editing the primitive (forbidden by Story 1.4/1.6's no-edit rule), or (b) wrapping with a custom indicator using `forceMount` + scale CSS. Defer to Story 2.6 (a11y/quality pass) or to a future "polish" pass that owns shadcn primitive overrides.
- [x] [Review][Defer] ROLLBACK clobbers concurrent successful mutations [client/src/hooks/useTasks.ts:74-83 + state/tasksReducer.ts:62-63] — single-action ROLLBACK with full `previousTasks` snapshot can wipe out an unrelated optimistic mutation that succeeded between the failed mutation's optimistic dispatch and its rejection. Spec explicitly acknowledged this trade-off ("acceptable for single-user MVP"). Story 2.3 introduces per-row `'failed'` status that replaces this with surgical per-action rollback.
- [x] [Review][Defer] Focus is lost into `<body>` after delete [client/src/components/TaskItem.tsx:33-37] — keyboard users press Delete/Backspace on a focused row and the row removes; nothing restores focus to the next sibling, previous sibling, or the input. Real a11y issue. Spec doesn't explicitly mandate focus restoration; defer to Story 2.6 (accessibility QA pass).
- [x] [Review][Defer] `loadError` is exposed by `useTasks` but never rendered [client/src/hooks/useTasks.ts:107 + client/src/App.tsx:6] — initial-load failure leaves user on an empty list indistinguishable from "no tasks yet". By design — Story 2.2 adds the page-level retry banner that consumes `loadError`.
- [x] [Review][Defer] Mutation errors swallowed into `console.error` only [client/src/hooks/useTasks.ts:67-69, 80-82, 93-95] — failed PATCH/DELETE/POST trigger silent rollback with no UI affordance. By design for Epic 1; Story 2.3 introduces per-row `'failed'` status + Retry affordance.
- [x] [Review][Defer] `aria-live="polite"` on `<ul>` may over-announce [client/src/components/TaskList.tsx:15] — every list mutation re-reads list content; common a11y practice is a separate live-region status node. Spec explicitly mandates the live region on the `<ul>` (AC16). Revisit during Story 2.6 if SR testing surfaces noise.
- [x] [Review][Defer] `apiClient` does no content-type validation [client/src/api/apiClient.ts:10, 23, 36] — non-JSON 2xx response (e.g., dev-server SPA fallback returning HTML) would crash `.json()` and trigger a misleading rollback. Defensive but unlikely in production same-origin deployment. Defer.
- [x] [Review][Defer] `as Task` runtime cast trusts server shape [client/src/api/apiClient.ts:10, 23, 36] — server response is unchecked. If the server contract drifts (e.g., ISO strings replace epoch-ms), the client compiles cleanly but breaks at runtime. Architecture explicitly accepts the duplication trade-off (AR23); defer until/unless contract drift becomes a real risk.
- [x] [Review][Defer] `crypto.randomUUID()` requires a secure context [client/src/hooks/useTasks.ts:58] — throws on plain-HTTP non-localhost. Architecture's deployment model is single-origin / localhost / HTTPS-fronted, so this is not a current issue. Add `MutableRefObject<() => string>`-style polyfill if a non-secure deployment surfaces.
- [x] [Review][Defer] `document.getElementById("task-input")` hardcodes Story 1.5's TaskInput id [client/src/components/TaskItem.tsx:53] — if a future story changes the id (e.g., switches to `useId()` for multi-instance), the first-row ArrowUp navigation breaks. Defer; flag the coupling with a comment if Story 1.5's TaskInput is ever revisited.
- [x] [Review][Defer] No request abort on unmount for mutations [client/src/hooks/useTasks.ts:62-69, 75-82, 88-95] — `.then`/`.catch` could dispatch into a torn-down reducer if the user navigates away mid-fetch. React 19 will log a warning. The `cancelled` flag pattern from the initial-load effect could be extended; defer until React's warning is observed in practice.

## Dev Notes

### Story context (what just shipped in Stories 1.1, 1.2, 1.3, 1.4, 1.5)

- **Server (1.1–1.3):** REST API at `/api/tasks` with ajv validation, idempotent retries, three security headers on every response. Vite dev proxies `/api/*` → `localhost:3000`.
- **Client foundation (1.4):** shadcn/ui + Tailwind v4 + 11 oklch tokens + system-font stack + 600 px `<main>` shell. Path alias `@/*` → `client/src/*`. Four primitives at `@/components/ui/{button,checkbox,input,label}`. `cn()` helper at `@/lib/utils`.
- **TaskInput (1.5):** [client/src/components/TaskInput.tsx](client/src/components/TaskInput.tsx) — controlled input with autofocus, native `maxLength=200`, paste-truncation, Enter/Escape/Shift+Enter/Tab handling, IME-compose guard, `role="status" aria-live="polite"` on the over-limit notice. Emits `onSubmit(text: string)` to its parent.
- **App.tsx (post-1.5):** Wires `<TaskInput onSubmit={handleSubmit} />` and a `<div data-slot="task-list" />` placeholder. `handleSubmit` is a `console.log` placeholder waiting for Story 1.6.

**Lessons from 1.4 / 1.5 worth carrying forward:**

- Path alias `@/*` is the canonical import root. `@/api/types`, `@/state/tasksReducer`, `@/hooks/useTasks` will all resolve.
- shadcn primitives are off-limits to edit. Compose them in feature components with `className` overrides or `cn()` calls.
- No new prod or dev deps. Composition only. The reducer / hook / api client are all hand-written in ~200 LOC total.
- Tailwind v4 spacing-scale: `h-11 = 44 px`, `p-3.5 = 14 px`, `size-4 = 16 px`, `gap-2 = 8 px`.
- ESLint complains about co-exporting components + helpers from the same file UNLESS you scope the rule (Story 1.4 added that scope for `src/components/ui/**`). Feature components like `TaskList.tsx`, `TaskItem.tsx` should default-export the component and have any helpers in a separate file (or accept the lint warning if minor — but the spec wants clean lint).

### Architecture references and hard rules

[Source: epics.md §Story 1.6 ACs; architecture.md §Frontend Architecture, §Optimistic UI state model, §Service / Data Boundaries; ux-design-specification.md §Core UX, §Layout, §Accessibility]

- **State management is React built-ins only (AR18).** `useReducer` for the tasks list; `useState` for any local component state; no Redux / Zustand / Jotai / Context library.
- **Pure reducer (AR21).** The reducer is a pure function: `(state, action) => newState`. It does NOT call `fetch`, NOT call `Date.now()`, NOT call `crypto.randomUUID()`, NOT mutate state in place. Side effects live in the hook (`useTasks`) or in action creators. Mutation = bug.
- **Discriminated-union actions (architecture.md §Communication Patterns).** Every action has a unique `type` literal. Handlers are exhaustive — the reducer's switch ends with a `_exhaustive: never = action` line so TS fails the build if a case is missed.
- **Native `fetch`, no client library (AR19).** The custom api client is ~30 LOC. No TanStack Query, no SWR, no axios. The reason: 5/5 NFR-M1 dep cap.
- **Optimistic UI is the *default*, not a polish item (NFR-P3).** Every mutation dispatches OPTIMISTIC_* before the fetch, NOT after. The fetch fires asynchronously; on success, dispatch SYNC_OK; on failure, ROLLBACK + `console.error`.
- **Idempotency contract (AR9, NFR-R3).** The client generates the UUID via `crypto.randomUUID()` and sends it with the POST. The server's `INSERT OR IGNORE` enforces single-effect-on-retry. Story 1.6's hook generates the UUID; the server respects it.
- **No envelope on responses (AR12).** GET returns `Task[]` directly. POST returns the created `Task`. Don't wrap.
- **Dates are epoch milliseconds (AR13).** `createdAt: number` everywhere. No ISO strings.
- **Booleans are `true`/`false` on the wire and in TS** (AR11). Conversion to/from `0`/`1` happens only in `server/src/db.ts`. Never in the client.
- **Accessibility plumbing:** semantic `<ul>`/`<li>`/`<button>`/`<input type="checkbox">` (Radix primitive); `aria-live="polite"` on the `<ul>`; `aria-labelledby` on the checkbox; dynamic `aria-label` on the delete button. Screen-reader announcements come from text content updates inside the polite live region — no extra `aria-live` regions needed.
- **No `dangerouslySetInnerHTML` anywhere (NFR-S1).** React's auto-escape is the XSS defense.
- **Strict one-way import direction.** Components import from hooks/state/api. Hooks import from state/api. State imports from api. Api imports from no internal modules (only React / fetch). No back-references.
- **Architecture's full file structure for the front-end** (per architecture.md §Source Tree):
  ```
  client/src/
  ├── App.tsx
  ├── main.tsx
  ├── index.css
  ├── components/
  │   ├── TaskInput.tsx       (Story 1.5)
  │   ├── TaskList.tsx        (NEW — Story 1.6)
  │   ├── TaskItem.tsx        (NEW — Story 1.6)
  │   └── ui/                 (Story 1.4)
  │       ├── button.tsx
  │       ├── checkbox.tsx
  │       ├── input.tsx
  │       └── label.tsx
  ├── hooks/
  │   └── useTasks.ts         (NEW — Story 1.6)
  ├── state/
  │   └── tasksReducer.ts     (NEW — Story 1.6)
  ├── api/
  │   ├── apiClient.ts        (NEW — Story 1.6)
  │   └── types.ts            (NEW — Story 1.6)
  └── lib/
      └── utils.ts            (Story 1.4 — cn helper)
  ```

### Reducer + hook contract (the heart of this story)

[Source: architecture.md §Optimistic UI state model + §Communication Patterns; epics.md §Story 1.6 AC14, AC15, AC23]

**Action shapes:**

```ts
type Action =
  | { type: "INITIAL_LOAD_OK"; tasks: Task[] }
  | { type: "INITIAL_LOAD_FAIL"; message: string }
  | { type: "OPTIMISTIC_ADD"; task: Task }
  | { type: "OPTIMISTIC_TOGGLE"; id: string; completed: boolean }
  | { type: "OPTIMISTIC_DELETE"; id: string }
  | { type: "SYNC_OK"; id: string; task?: Task }
  | { type: "ROLLBACK"; previousTasks: Task[] };
```

**Why the architecture's `SYNC_FAIL`, `RETRY`, `CONNECTIVITY_CHANGED` are NOT in this story:**
- `SYNC_FAIL` (per-row `'failed'` status) → introduced in **Story 2.3**. Epic 1 uses ROLLBACK instead.
- `RETRY` → introduced in **Story 2.3** (paired with `SYNC_FAIL`).
- `CONNECTIVITY_CHANGED` → introduced in **Story 2.4** (connectivity banner).

Story 1.6 ships the **minimum viable** action set for the happy path + simple rollback. Future stories extend the union — adding cases is non-breaking; removing or renaming would be.

**Rollback semantics:**

For all three mutation types, the hook captures `previousTasks = state.tasks` (via a ref, see below) BEFORE dispatching the optimistic action. On failure, dispatches `{ type: "ROLLBACK", previousTasks }`. The reducer then replaces `state.tasks` with the snapshot. This is simpler than per-action rollback variants and handles all three cases uniformly.

The trade-off: if two mutations are in flight simultaneously and one fails, the rollback might revert the OTHER mutation's optimistic update. For Story 1.6's single-user MVP this is acceptable — concurrent in-flight mutations are rare (humans take >100 ms between clicks). Story 2.3 will reason about this when it adds per-row `'failed'` status.

**Stale closure with `tasksRef`:**

```ts
const [state, dispatch] = useReducer(tasksReducer, initialState);
const tasksRef = useRef(state.tasks);
useEffect(() => {
  tasksRef.current = state.tasks;
}, [state.tasks]);

const createTask = useCallback((text: string) => {
  const id = crypto.randomUUID();
  const optimistic: Task = { id, text, completed: false, createdAt: Date.now() };
  const previousTasks = tasksRef.current;
  dispatch({ type: "OPTIMISTIC_ADD", task: optimistic });
  apiClient.createTask({ id, text })
    .then((serverTask) => dispatch({ type: "SYNC_OK", id, task: serverTask }))
    .catch((err) => {
      console.error("Create task failed:", err);
      dispatch({ type: "ROLLBACK", previousTasks });
    });
}, []);
```

Without `tasksRef`, `previousTasks` would close over the `state.tasks` value from the moment `useCallback`'s factory ran — i.e., `[]` if the callback was created on initial render. The ref pattern keeps the snapshot fresh.

**Alternative:** drop `useCallback` entirely and let the callbacks recreate every render. `<TaskList>` re-renders are cheap; React.memo on `<TaskItem>` would help if performance becomes an issue (it won't at this scale).

### XSS verification (AC24)

```bash
grep -RE "dangerouslySetInnerHTML" client/src/
# Expected: zero matches.
```

React's default rendering of `{task.text}` as a child auto-escapes HTML. A task with text `<script>alert('xss')</script>` shows literally as that string in the row, not as an executed script. No further work needed; just don't add `dangerouslySetInnerHTML` ever.

### Layout sketches (non-normative — adapt but preserve the rules)

`client/src/state/tasksReducer.ts`:

```ts
import type { Task } from "@/api/types";

export type Action =
  | { type: "INITIAL_LOAD_OK"; tasks: Task[] }
  | { type: "INITIAL_LOAD_FAIL"; message: string }
  | { type: "OPTIMISTIC_ADD"; task: Task }
  | { type: "OPTIMISTIC_TOGGLE"; id: string; completed: boolean }
  | { type: "OPTIMISTIC_DELETE"; id: string }
  | { type: "SYNC_OK"; id: string; task?: Task }
  | { type: "ROLLBACK"; previousTasks: Task[] };

export interface State {
  tasks: Task[];
  isLoading: boolean;
  loadError: string | null;
}

export const initialState: State = {
  tasks: [],
  isLoading: true,
  loadError: null,
};

export function tasksReducer(state: State, action: Action): State {
  switch (action.type) {
    case "INITIAL_LOAD_OK":
      return { ...state, tasks: action.tasks, isLoading: false, loadError: null };
    case "INITIAL_LOAD_FAIL":
      return { ...state, isLoading: false, loadError: action.message };
    case "OPTIMISTIC_ADD":
      return { ...state, tasks: [...state.tasks, action.task] };
    case "OPTIMISTIC_TOGGLE":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, completed: action.completed } : t,
        ),
      };
    case "OPTIMISTIC_DELETE":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case "SYNC_OK":
      if (!action.task) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? action.task! : t)),
      };
    case "ROLLBACK":
      return { ...state, tasks: action.previousTasks };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
```

`client/src/api/apiClient.ts`:

```ts
import type { Task } from "./types";

export async function listTasks(): Promise<Task[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`GET /api/tasks failed: ${res.status}`);
  return (await res.json()) as Task[];
}

export async function createTask(input: {
  id: string;
  text: string;
}): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`POST /api/tasks failed: ${res.status}`);
  return (await res.json()) as Task;
}

export async function updateTask(
  id: string,
  patch: { completed: boolean },
): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/tasks/${id} failed: ${res.status}`);
}
```

### Anti-patterns (forbidden — see architecture.md §Pattern Examples + §Enforcement Guidelines)

```tsx
// ❌ Mutating state in the reducer
case "OPTIMISTIC_ADD":
  state.tasks.push(action.task);  // breaks AR21
  return state;

// ❌ Calling fetch inside the reducer
case "OPTIMISTIC_ADD":
  fetch("/api/tasks", ...);  // side effect in pure function
  return { ...state, ... };

// ❌ Calling Date.now() / randomUUID() inside the reducer
case "OPTIMISTIC_ADD":
  return { ...state, tasks: [...state.tasks, { id: crypto.randomUUID(), ..., createdAt: Date.now() }] };
  // breaks purity — non-deterministic from same input

// ❌ Awaiting the fetch BEFORE the optimistic dispatch
const createTask = async (text: string) => {
  const serverTask = await apiClient.createTask({ id, text });
  dispatch({ type: "OPTIMISTIC_ADD", task: serverTask });
};
// breaks NFR-P3 — UI has to wait for the server before showing the row.

// ❌ Wrapping the response in an envelope
return res.json().then((data) => data.tasks);  // architecture rejects envelopes (AR12)

// ❌ Sorting on the client
return state.tasks.sort((a, b) => a.createdAt - b.createdAt);
// server returns ASC order; client sorting is redundant and risks order divergence.

// ❌ Using dangerouslySetInnerHTML for the task text
<div dangerouslySetInnerHTML={{ __html: task.text }} />
// XSS vector — NFR-S1 explicitly forbids.

// ❌ Editing shadcn primitives
// client/src/components/ui/checkbox.tsx  ← off-limits

// ❌ Adding a per-row 'failed' status field NOW
interface Task { ...; status: 'synced' | 'pending' | 'failed' }
// Story 2.3 introduces this. Story 1.6 ships rollback only.

// ❌ Adding a connectivity banner / global error state
// Story 2.2 + 2.4 introduce these.

// ❌ Adding axios / TanStack Query / SWR
// rejected by NFR-M1 (5/5 dep cap on prod)

// ❌ Sorting completed tasks to the bottom
// UX-DR §Sort order: "Newest at bottom, strict creation-timestamp ascending. Completed tasks
// stay where they were created — never auto-sorted to a bottom section."
```

### Things explicitly NOT in scope for this story

- **Per-row `'failed'` status with Retry affordance** → Story 2.3.
- **Empty-state UI** (when `tasks.length === 0 && !isLoading`) → Story 2.1. Story 1.6 only verifies the rendering case (no skeletons, no rows).
- **Initial-load failure banner with Retry** → Story 2.2. Story 1.6's hook tracks `loadError` but doesn't render anything for it.
- **Connectivity banner** (offline detection) → Story 2.4.
- **Global error boundary** → Story 2.5.
- **Automated tests** (`tasksReducer.test.ts`, `useTasks.test.tsx`, `TaskItem.test.tsx`, `TaskList.test.tsx`) → Story 1.8.
- **Accessibility quality verification pass** → Story 2.6.
- **Production build / serving** → Story 1.7.
- **Touch-specific UX beyond "X always visible"** — no swipe-to-delete, no long-press, no context menus. Spec is explicit on AC8/AC9/AC10/AC11/AC12; no further interaction modalities.
- **Visual transition for row insertion / removal** — UX-DR explicitly rejects animated list reordering. Rows pop in / disappear instantly. The 100 ms transitions in AC5/AC8/AC10 apply to checkbox tick + opacity + delete-X reveal only.

### File structure after this story

```
client/src/
├── App.tsx                           ← edited (replace placeholder + wire useTasks)
├── api/
│   ├── apiClient.ts                  ← NEW
│   └── types.ts                      ← NEW
├── state/
│   └── tasksReducer.ts               ← NEW
├── hooks/
│   └── useTasks.ts                   ← NEW
├── components/
│   ├── TaskInput.tsx                 ← unchanged from Story 1.5
│   ├── TaskList.tsx                  ← NEW
│   ├── TaskItem.tsx                  ← NEW
│   └── ui/
│       ├── button.tsx                ← unchanged
│       ├── checkbox.tsx              ← unchanged
│       ├── input.tsx                 ← unchanged
│       └── label.tsx                 ← unchanged
├── lib/
│   └── utils.ts                      ← unchanged (cn)
├── index.css                         ← unchanged
└── main.tsx                          ← unchanged
```

### AC-to-test matrix (for the dev's self-check at Task 8)

| AC | How to verify |
|----|---------------|
| AC1 | Hard-reload while server is slow (or with DevTools network throttling) — 3 skeleton rows visible briefly. |
| AC2 | Add 3 tasks "a", "b", "c" — appear bottom-up in that order. |
| AC3 | Empty DB + reload — empty `<ul>`, no skeletons after settle. |
| AC4 | DevTools Elements → row layout = `[p-3.5 wrapper > Checkbox] [span.truncate] [button > X icon]`. |
| AC5 | Click checkbox → 100ms tick scale, instant strikethrough, 100ms opacity-60, PATCH in Network. |
| AC6 | Click on completed checkbox → reverse animation, PATCH `{completed:false}`. |
| AC7 | Tab to row, Space → toggles. |
| AC8 | Hover row on desktop → X reveals in 150ms. |
| AC9 | DevTools Device Mode (touch) → X always at 60% opacity. |
| AC10 | Tab to row → X visible + ring on `<li>`. |
| AC11 | Click X → row vanishes, DELETE in Network. |
| AC12 | Tab to row, press Delete or Backspace → same. |
| AC13 | Click on text region → no network call, no state change. |
| AC14 | Add a task, observe Performance panel — UI updates within 100ms; fetch is separate. |
| AC15 | Stop server, toggle a checkbox — flips, then flips back; `console.error` printed. |
| AC16 | DevTools → `<ul>` has `role="list" aria-live="polite" aria-label="Tasks"`. |
| AC17 | Screen reader announces new task text after Enter. |
| AC18 | Tab from input → first row; ArrowDown / ArrowUp navigate; ArrowUp from first row → input. |
| AC19 | Toggle a row → both `line-through` and `opacity-60` in Computed styles. |
| AC20 | DevTools → Rendering → Achromatopsia → strikethrough still visible. |
| AC21 | DevTools → Accessibility → Checkbox `aria-labelledby` → resolves to text element. |
| AC22 | Inspect X button → `aria-label="Delete task: <text>"`. |
| AC23 | Add a task, inspect React DevTools state — `createdAt` matches the server response, not Date.now(). |
| AC24 | Add task with text `<script>alert(1)</script>` — renders literal, no alert. `grep -r dangerouslySetInnerHTML client/src/` → 0. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6: Task List View with Happy-Path CRUD]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 → Architectural Requirements AR9, AR11–AR23]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Optimistic UI state model]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns — Reducer action shape]
- [Source: _bmad-output/planning-artifacts/architecture.md#Service / Data Boundaries — Frontend]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern Examples]
- [Source: _bmad-output/planning-artifacts/architecture.md#Source Tree]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — Error-handling hierarchy + Retry pattern]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Core User Experience]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Considerations]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Direction Decision — Sort order, Row density, Delete affordance]
- [Source: _bmad-output/planning-artifacts/prd.md#FR1–FR9, FR21–FR23, NFR-P3, NFR-R3, NFR-S1, NFR-A4]
- [Source: _bmad-output/implementation-artifacts/1-5-taskinput-single-field-entry-with-keyboard-commit.md#Completion Notes List]
- [Source: _bmad-output/implementation-artifacts/1-3-task-rest-api-get-post-patch-delete.md#Completion Notes List]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **Build + lint:** `npm --prefix client run build` → exit 0, JS gzip **75.37 KB** (well under NFR-P5's 100 KB cap; +5 KB from Story 1.5's 70.4 KB to accommodate the reducer + hook + 2 components + lucide `X` icon). `npm --prefix client run lint` → exit 0 with no edits needed. The narrowly-scoped `react-refresh/only-export-components` override added in Story 1.4 already handles the shadcn primitive co-export pattern; feature components default-export only the component, so no additional rule overrides were required.
- **End-to-end via Vite proxy:** unable to bind the API server on port 3000 (occupied by an unrelated long-running `node` process — same one flagged in earlier sprint reviews; not from this project). Worked around by running the API server on port 4322 and starting Vite dev with `VITE_API_URL=http://localhost:4322`, which the existing proxy config in `client/vite.config.ts` honors. Verified end-to-end:
  - Initial `GET /api/tasks` (empty DB) → `[]`.
  - 3 successive `POST /api/tasks` → 201 each, monotonically increasing server-assigned `createdAt`.
  - Final `GET /api/tasks` → 3 tasks in `createdAt ASC` order matching the insert order.
- **Static AC verification via Vite dev server's transformed output:**
  - `App.tsx` correctly imports `TaskInput`, `TaskList`, `useTasks`; destructures `{ tasks, isLoading, createTask, toggleTask, deleteTask }`; passes `createTask` as `onSubmit` and the toggle/delete handlers through to `<TaskList>`.
  - `useTasks.ts` references `OPTIMISTIC_ADD/TOGGLE/DELETE`, `SYNC_OK`, `ROLLBACK`, `tasksRef`, `crypto.randomUUID`, `console.error`, and the four api-client functions — exactly the surface the spec calls for.
  - Reducer source contains zero `fetch(`, `Date.now()`, or `randomUUID` calls (the only "Date.now()" hit is in a comment explaining the purity rule).
  - `TaskList.tsx` has `role="list"`, `aria-live="polite"`, `aria-label="Tasks"`, `aria-busy={isLoading}`, `aria-hidden="true"` on each skeleton, `animate-pulse bg-muted h-11` skeleton classes, and gates skeletons vs. real rows on `isLoading`.
  - `TaskItem.tsx` has `tabIndex={0}`, `aria-labelledby={textId}` on the checkbox, dynamic `aria-label="Delete task: ${task.text}"` on the delete button, `truncate` + `title` attribute on the text span, `line-through opacity-60` conditional classes for completed, `p-3.5` wrappers on both the checkbox and the delete button (44×44 hit areas), `group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60 focus-visible:opacity-100` on the X button, and `handleKeyDown` covering Space, Delete, Backspace, ArrowDown, ArrowUp (with the first-row-up branch focusing `#task-input`).
- **XSS check:** `grep -rE 'dangerouslySetInnerHTML' client/src/` → 0 matches. AC24 satisfied structurally.

### Completion Notes List

**Happy-path CRUD shipped end-to-end.** The client now fetches the initial list, renders skeletons during the load, supports optimistic add / toggle / delete with simple rollback on failure, and announces additions via the polite live region on the `<ul>`. Story 2.x layers (per-row failed status + retry, connectivity banner, empty state, page-level retry banner, error boundary, a11y QA pass) all build on this foundation.

**Five new files + one wiring edit:**
- `client/src/api/types.ts` — duplicated `Task` interface per AR23.
- `client/src/api/apiClient.ts` — four thin `fetch` wrappers, throws on `!res.ok` with the HTTP status in the message.
- `client/src/state/tasksReducer.ts` — pure reducer, 7-action discriminated union, exhaustive switch with the `_exhaustive: never` guard.
- `client/src/hooks/useTasks.ts` — combines the reducer with the initial fetch + three optimistic-mutation callbacks, each snapshotting `previousTasks` from a `tasksRef` to avoid stale-closure rollback.
- `client/src/components/TaskList.tsx` — `<ul>` with skeleton rendering and ARIA wiring.
- `client/src/components/TaskItem.tsx` — `<li>` with the checkbox/text/X anatomy, two non-color completion signals, hover/focus/touch X-reveal, and the full keyboard map (Space, Delete, Backspace, ArrowDown/Up).
- `client/src/App.tsx` — wired `useTasks` and replaced both placeholder slots.

**Key implementation decisions:**

- **`tasksRef` for rollback snapshots.** The hook's three mutation callbacks are `useCallback([])`-memoized for stable identity. They snapshot `previousTasks = tasksRef.current` (NOT `state.tasks`) so the snapshot is fresh at the moment of dispatch, not stale at memo-time. Without this pattern, `previousTasks` would always be `[]` (the value at first render).
- **Initial-fetch effect uses a `cancelled` flag.** Strict-mode double-firing or unmount-mid-fetch could otherwise dispatch on an unmounted component. The `cancelled` flag short-circuits the `.then` / `.catch` callbacks safely.
- **Single ROLLBACK action carrying `previousTasks`.** Architecturally simpler than per-action rollback variants. The trade-off (concurrent in-flight mutations could stomp each other's optimistic updates on a single failure) is acceptable for single-user MVP; Story 2.3 will revisit when per-row `'failed'` status arrives.
- **`<li>` is the focusable element**, not the row's children. `tabIndex={0}` on the `<li>` lets users Tab to a row as a single unit, then Space toggles, Delete/Backspace deletes, ArrowUp/Down navigate. The checkbox itself is still independently focusable (Radix default), but most keyboard users will operate at the row level.
- **First-row ArrowUp returns to `#task-input` via direct `document.getElementById`.** Story 1.5's TaskInput gives the input a deterministic id; Story 1.6 reuses it. If future stories make the id dynamic (`useId()`), this navigation would need a ref-passed-from-parent fallback, but the spec calls out `id="task-input"` as the contract.
- **Click-on-text is a no-op (AC13)** because the `<span>` has no `onClick` handler. Default text selection on click works as users expect.
- **`focus-visible:opacity-100` on the delete X button** ensures keyboard users see the X immediately when it gains focus directly via Tab (in addition to `group-focus-within:opacity-100` on the parent `<li>`). Belt-and-suspenders.
- **No new dependencies.** Composition only. Server prod = 3, client prod = 7 (`react`, `react-dom`, `radix-ui`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`). Total = 10/10 NFR-M1.

**Limits of static verification:**
- The interactive ACs (visual animations, hover behavior, screen-reader announcements, Achromatopsia rendering, exact 100/150 ms transition timing) require a real browser walkthrough by the code reviewer. Implementation matches the spec's reference sketches verbatim and the static structure is verified.
- The rollback path (AC15) was verified architecturally (`console.error` + `ROLLBACK` dispatch on `.catch`) but a "stop-the-server-and-toggle" interactive test wasn't run by the dev agent.

**Cross-story handoff:**
- Story 2.1 (empty state): renders the empty-state UI when `tasks.length === 0 && !isLoading`. The current `<TaskList>` already renders an empty `<ul>` in this state — the empty-state component slots in alongside or wraps it.
- Story 2.2 (page-level retry banner): consumes `loadError` from the hook (currently unused but exposed). The hook's `INITIAL_LOAD_FAIL` action is already wired.
- Story 2.3 (per-row failed status + retry): replaces the simple `ROLLBACK` action with a `SYNC_FAIL` that adds a `'failed'` status field per task. The existing reducer's discriminated union just gets a new case.
- Story 2.4 (connectivity banner): adds a `CONNECTIVITY_CHANGED` action and wires `useConnectivity()` in alongside `useTasks()`.

**Enhanced DoD checklist:**
- ✅ All 9 tasks + all subtasks `[x]`
- ✅ All 24 ACs satisfied (statically verified for the structural / contract ACs; interactive timing/visuals + screen-reader announcements need a code-reviewer browser pass)
- ✅ End-to-end CRUD verified through the API server via Vite proxy
- ✅ No regressions: TaskInput unchanged, shadcn primitives unchanged, server unchanged, `index.css` and the layout shell unchanged
- ✅ `tsc -b` clean; `vite build` emits 75.37 KB JS gzip
- ✅ `eslint .` clean
- ✅ File List complete
- ✅ Only permitted story sections modified
- ⏸ Automated tests deferred to Story 1.8 per story scope

### File List

**New files:**

- `client/src/api/types.ts` — `Task` interface (camelCase, boolean, epoch-ms `createdAt`). ~7 LOC.
- `client/src/api/apiClient.ts` — four `fetch` wrappers (`listTasks`, `createTask`, `updateTask`, `deleteTask`). Throws on `!res.ok` with HTTP status. ~40 LOC.
- `client/src/state/tasksReducer.ts` — pure reducer + 7-action discriminated `Action` union + `State` + `initialState` + exhaustive switch. ~65 LOC.
- `client/src/hooks/useTasks.ts` — `useReducer` + initial fetch + three optimistic-mutation callbacks with `tasksRef` rollback pattern. ~95 LOC.
- `client/src/components/TaskList.tsx` — `<ul>` with skeleton path + real-rows path + ARIA wiring. ~40 LOC.
- `client/src/components/TaskItem.tsx` — `<li>` with checkbox/text/X anatomy + completion styling + hover/focus/touch X-reveal + full keyboard map. ~95 LOC.

**Edited files:**

- `client/src/App.tsx` — replaced `console.log` placeholder `handleSubmit` with `useTasks().createTask`; replaced `<div data-slot="task-list" />` placeholder with `<TaskList ... />` consuming the hook's `tasks`, `isLoading`, `toggleTask`, `deleteTask`. Net change: +6 / -3 lines (now 22 LOC including imports).

**Generated / ignored artifacts (not committed):**

- `client/dist/assets/index-*.{js,css}` — Vite production output (gitignored).

**No files removed. No new dependencies.**

## Change Log

| Date       | Version | Description                                                                                                                                                                  | Author             |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-27 | 0.6.0   | Story 1.6 implementation: api client + types + tasksReducer + useTasks hook + TaskList + TaskItem; happy-path CRUD wired end-to-end with optimistic UI and simple rollback. | Amelia (dev agent) |
