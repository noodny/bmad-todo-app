import type { Task } from "@/api/types";

export type SyncStatus = "synced" | "pending" | "failed";
export type PendingMutation = "create" | "toggle" | "delete";
export type ClientTask = Task & { status: SyncStatus; pendingMutation?: PendingMutation };

export type Action =
  | { type: "INITIAL_LOAD_OK"; tasks: Task[] }
  | { type: "INITIAL_LOAD_FAIL"; message: string }
  | { type: "INITIAL_LOAD_RETRY" }
  | { type: "OPTIMISTIC_ADD"; task: Task }
  | { type: "OPTIMISTIC_TOGGLE"; id: string; completed: boolean }
  | { type: "OPTIMISTIC_DELETE"; id: string }
  | { type: "SYNC_OK"; id: string; task?: Task }
  | { type: "SYNC_FAIL"; id: string }
  | { type: "RETRY"; id: string }
  | { type: "CONNECTIVITY_CHANGED"; online: boolean };

export interface State {
  tasks: ClientTask[];
  isLoading: boolean;
  loadError: string | null;
  online: boolean;
}

export const initialState: State = { tasks: [], isLoading: true, loadError: null, online: true };

// AR21: pure reducer — no side effects, no mutation.
export function tasksReducer(state: State, action: Action): State {
  const mapTask = (id: string, fn: (t: ClientTask) => ClientTask): ClientTask[] =>
    state.tasks.map((t) => (t.id === id ? fn(t) : t));
  switch (action.type) {
    case "INITIAL_LOAD_OK":
      return { ...state, tasks: action.tasks.map((t) => ({ ...t, status: "synced" })), isLoading: false, loadError: null };
    case "INITIAL_LOAD_FAIL":
      return { ...state, isLoading: false, loadError: action.message };
    case "INITIAL_LOAD_RETRY":
      return { ...state, isLoading: true, loadError: null };
    case "OPTIMISTIC_ADD":
      return { ...state, tasks: [...state.tasks, { ...action.task, status: "pending", pendingMutation: "create" }] };
    case "OPTIMISTIC_TOGGLE":
      return { ...state, tasks: mapTask(action.id, (t) => ({ ...t, completed: action.completed, status: "pending", pendingMutation: "toggle" })) };
    case "OPTIMISTIC_DELETE":
      // Soft-delete; render layer hides it. SYNC_OK removes; SYNC_FAIL → 'failed' → row reappears.
      return { ...state, tasks: mapTask(action.id, (t) => ({ ...t, status: "pending", pendingMutation: "delete" })) };
    case "SYNC_OK": {
      const target = state.tasks.find((t) => t.id === action.id);
      if (target?.pendingMutation === "delete") return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
      return { ...state, tasks: mapTask(action.id, (t) => ({ ...(action.task ?? t), status: "synced", pendingMutation: undefined })) };
    }
    case "SYNC_FAIL":
      return { ...state, tasks: mapTask(action.id, (t) => ({ ...t, status: "failed" })) };
    case "RETRY":
      return { ...state, tasks: mapTask(action.id, (t) => ({ ...t, status: "pending" })) };
    case "CONNECTIVITY_CHANGED":
      return state.online === action.online ? state : { ...state, online: action.online };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
