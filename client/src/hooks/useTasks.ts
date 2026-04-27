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
  type ClientTask,
  type PendingMutation,
  type State,
} from "@/state/tasksReducer";
import { useConnectivity } from "./useConnectivity";

interface UseTasksReturn {
  tasks: ClientTask[];
  isLoading: boolean;
  loadError: string | null;
  online: boolean;
  createTask: (text: string) => void;
  toggleTask: (id: string, completed: boolean) => void;
  deleteTask: (id: string) => void;
  retryInitialLoad: () => void;
  retryMutation: (id: string) => void;
}

const SLOW_LOAD_MS = 10_000;
export const LOAD_FAIL_MESSAGE = "Could not load tasks.";

export function useTasks(): UseTasksReturn {
  const [state, dispatch] = useReducer(tasksReducer, initialState);

  // Latest tasks ref — read by retryMutation to look up pendingMutation by id.
  const tasksRef = useRef<State["tasks"]>(state.tasks);
  useEffect(() => {
    tasksRef.current = state.tasks;
  }, [state.tasks]);

  // In-flight retry guard — bails on rapid double-clicks of the same row's Retry.
  const retryInFlightRef = useRef<Set<string>>(new Set());

  // Cleanup of the most recent initial-load attempt — retry aborts it first.
  const loadCleanupRef = useRef<(() => void) | null>(null);

  const handleConnectivity = useCallback(
    (online: boolean) => dispatch({ type: "CONNECTIVITY_CHANGED", online }),
    [],
  );
  useConnectivity(handleConnectivity);

  // `resolved` + AbortController suppress double-dispatch across slow-timer/fetch/unmount.
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
        // Suppress AbortError from our own slow-load abort or unmount.
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

  // Mutation runner — TypeError discriminates fetch network failure from apiClient HTTP errors.
  const runMutation = useCallback(
    (id: string, kind: PendingMutation, request: () => Promise<Task | void>) => {
      return request()
        .then((r) => {
          dispatch({ type: "SYNC_OK", id, task: kind === "create" ? (r as Task) : undefined });
          dispatch({ type: "CONNECTIVITY_CHANGED", online: true }); // success implies online — recovery path for transient TypeErrors that didn't fire window 'online' event
        })
        .catch((err: unknown) => {
          console.error(`${kind} task failed:`, err);
          dispatch({ type: "SYNC_FAIL", id });
          if (err instanceof TypeError) dispatch({ type: "CONNECTIVITY_CHANGED", online: false });
        });
    },
    [],
  );

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

  const retryMutation = useCallback((id: string) => {
    if (retryInFlightRef.current.has(id)) return;
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task?.pendingMutation) return;
    retryInFlightRef.current.add(id);
    dispatch({ type: "RETRY", id });
    const m = task.pendingMutation;
    const request =
      m === "create" ? () => apiCreateTask({ id, text: task.text })
      : m === "toggle" ? () => apiUpdateTask(id, { completed: task.completed })
      : () => apiDeleteTask(id);
    runMutation(id, m, request).finally(() => retryInFlightRef.current.delete(id));
  }, [runMutation]);

  return {
    tasks: state.tasks,
    isLoading: state.isLoading,
    loadError: state.loadError,
    online: state.online,
    createTask,
    toggleTask,
    deleteTask,
    retryInitialLoad,
    retryMutation,
  };
}
