import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  listTasks,
  updateTask as apiUpdateTask,
} from "@/api/apiClient";
import type { Task } from "@/api/types";
import {
  initialState,
  tasksReducer,
  type State,
} from "@/state/tasksReducer";

interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  loadError: string | null;
  createTask: (text: string) => void;
  toggleTask: (id: string, completed: boolean) => void;
  deleteTask: (id: string) => void;
}

export function useTasks(): UseTasksReturn {
  const [state, dispatch] = useReducer(tasksReducer, initialState);

  // Keep a ref of the current tasks list so the memoized mutation callbacks
  // can snapshot `previousTasks` for ROLLBACK without going stale.
  const tasksRef = useRef<State["tasks"]>(state.tasks);
  useEffect(() => {
    tasksRef.current = state.tasks;
  }, [state.tasks]);

  // Initial fetch.
  useEffect(() => {
    let cancelled = false;
    listTasks()
      .then((tasks) => {
        if (cancelled) return;
        dispatch({ type: "INITIAL_LOAD_OK", tasks });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error("Initial load failed:", err);
        dispatch({ type: "INITIAL_LOAD_FAIL", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createTask = useCallback((text: string) => {
    const id = crypto.randomUUID();
    const optimistic: Task = {
      id,
      text,
      completed: false,
      createdAt: Date.now(),
    };
    const previousTasks = tasksRef.current;
    dispatch({ type: "OPTIMISTIC_ADD", task: optimistic });
    apiCreateTask({ id, text })
      .then((serverTask) => {
        dispatch({ type: "SYNC_OK", id, task: serverTask });
      })
      .catch((err: unknown) => {
        console.error("Create task failed:", err);
        dispatch({ type: "ROLLBACK", previousTasks });
      });
  }, []);

  const toggleTask = useCallback((id: string, completed: boolean) => {
    const previousTasks = tasksRef.current;
    dispatch({ type: "OPTIMISTIC_TOGGLE", id, completed });
    apiUpdateTask(id, { completed })
      .then(() => {
        dispatch({ type: "SYNC_OK", id });
      })
      .catch((err: unknown) => {
        console.error("Update task failed:", err);
        dispatch({ type: "ROLLBACK", previousTasks });
      });
  }, []);

  const deleteTask = useCallback((id: string) => {
    const previousTasks = tasksRef.current;
    dispatch({ type: "OPTIMISTIC_DELETE", id });
    apiDeleteTask(id)
      .then(() => {
        dispatch({ type: "SYNC_OK", id });
      })
      .catch((err: unknown) => {
        console.error("Delete task failed:", err);
        dispatch({ type: "ROLLBACK", previousTasks });
      });
  }, []);

  return {
    tasks: state.tasks,
    isLoading: state.isLoading,
    loadError: state.loadError,
    createTask,
    toggleTask,
    deleteTask,
  };
}
