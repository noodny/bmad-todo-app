import type { Task } from "@/api/types";

export type Action =
  | { type: "INITIAL_LOAD_OK"; tasks: Task[] }
  | { type: "INITIAL_LOAD_FAIL"; message: string }
  | { type: "INITIAL_LOAD_RETRY" }
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

// Pure reducer (AR21): never call fetch / Date.now() / crypto.randomUUID()
// here. Side effects belong in the hook. Mutation = bug.
export function tasksReducer(state: State, action: Action): State {
  switch (action.type) {
    case "INITIAL_LOAD_OK":
      return {
        ...state,
        tasks: action.tasks,
        isLoading: false,
        loadError: null,
      };
    case "INITIAL_LOAD_FAIL":
      return { ...state, isLoading: false, loadError: action.message };
    case "INITIAL_LOAD_RETRY":
      return { ...state, isLoading: true, loadError: null };
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
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
      };
    case "SYNC_OK":
      // For create: replace optimistic task with server's authoritative
      // version (especially server-assigned createdAt). For toggle/delete:
      // no task provided, no-op.
      if (!action.task) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? action.task! : t,
        ),
      };
    case "ROLLBACK":
      return { ...state, tasks: action.previousTasks };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
