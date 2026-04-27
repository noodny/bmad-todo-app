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
  retryInitialLoad: () => void;
}

const SLOW_LOAD_MS = 10_000;
export const LOAD_FAIL_MESSAGE = "Could not load tasks.";

export function useTasks(): UseTasksReturn {
  const [state, dispatch] = useReducer(tasksReducer, initialState);

  // Keep a ref of the current tasks list so the memoized mutation callbacks
  // can snapshot `previousTasks` for ROLLBACK without going stale.
  const tasksRef = useRef<State["tasks"]>(state.tasks);
  useEffect(() => {
    tasksRef.current = state.tasks;
  }, [state.tasks]);

  // Cleanup of the most recent initial-load attempt — retry aborts it first.
  const loadCleanupRef = useRef<(() => void) | null>(null);

  // The local `resolved` flag + AbortController guarantee no double-dispatch
  // across the slow-load timer / fetch / unmount races.
  const performInitialLoad = useCallback(() => {
    let resolved = false;
    const controller = new AbortController();
    const slowTimer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      controller.abort();
      dispatch({ type: "INITIAL_LOAD_FAIL", message: LOAD_FAIL_MESSAGE });
    }, SLOW_LOAD_MS);

    listTasks(controller.signal)
      .then((tasks) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(slowTimer);
        dispatch({ type: "INITIAL_LOAD_OK", tasks });
      })
      .catch((err: unknown) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(slowTimer);
        // Suppress AbortError: it surfaces from our own slow-load abort
        // (the timer's dispatch already fired the FAIL) or from unmount.
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Initial load failed:", err);
        dispatch({ type: "INITIAL_LOAD_FAIL", message: LOAD_FAIL_MESSAGE });
      });

    return () => {
      resolved = true;
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, []);

  useEffect(() => {
    loadCleanupRef.current = performInitialLoad();
    return () => {
      loadCleanupRef.current?.();
      loadCleanupRef.current = null;
    };
  }, [performInitialLoad]);

  const retryInitialLoad = useCallback(() => {
    loadCleanupRef.current?.(); // abort prior attempt's controller + timer
    dispatch({ type: "INITIAL_LOAD_RETRY" });
    loadCleanupRef.current = performInitialLoad();
  }, [performInitialLoad]);

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
    retryInitialLoad,
  };
}
