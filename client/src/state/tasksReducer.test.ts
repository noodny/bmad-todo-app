import { describe, it, expect } from "vitest";
import type { Task } from "@/api/types";
import {
  initialState,
  tasksReducer,
  type Action,
  type ClientTask,
  type State,
} from "./tasksReducer";

const taskA: Task = { id: "a", text: "alpha", completed: false, createdAt: 1 };
const taskB: Task = { id: "b", text: "bravo", completed: false, createdAt: 2 };
const taskC: Task = { id: "c", text: "charlie", completed: true, createdAt: 3 };

const synced = (t: Task): ClientTask => ({ ...t, status: "synced" });

const stateWithTasks = (tasks: ClientTask[]): State => ({
  tasks,
  isLoading: false,
  loadError: null,
});

describe("tasksReducer", () => {
  it("INITIAL_LOAD_OK wraps wire tasks with status: 'synced'", () => {
    const start: State = { tasks: [], isLoading: true, loadError: "stale" };
    const next = tasksReducer(start, {
      type: "INITIAL_LOAD_OK",
      tasks: [taskA, taskB],
    });
    expect(next.isLoading).toBe(false);
    expect(next.loadError).toBeNull();
    expect(next.tasks).toEqual([
      { ...taskA, status: "synced" },
      { ...taskB, status: "synced" },
    ]);
  });

  it("INITIAL_LOAD_FAIL sets loadError, clears loading, preserves tasks", () => {
    const start = stateWithTasks([synced(taskA)]);
    const next = tasksReducer(start, {
      type: "INITIAL_LOAD_FAIL",
      message: "boom",
    });
    expect(next.tasks).toEqual([{ ...taskA, status: "synced" }]);
    expect(next.isLoading).toBe(false);
    expect(next.loadError).toBe("boom");
  });

  it("INITIAL_LOAD_RETRY sets loading, clears error, preserves tasks", () => {
    const prevTasks: ClientTask[] = [];
    const start = Object.freeze({
      tasks: prevTasks,
      isLoading: false,
      loadError: "Could not load tasks.",
    }) as State;
    const next = tasksReducer(start, { type: "INITIAL_LOAD_RETRY" });
    expect(next.isLoading).toBe(true);
    expect(next.loadError).toBeNull();
    expect(next.tasks).toBe(prevTasks);
    expect(next).not.toBe(start);
  });

  it("OPTIMISTIC_ADD appends with status='pending', pendingMutation='create'", () => {
    const start = stateWithTasks([synced(taskA), synced(taskB)]);
    const next = tasksReducer(start, { type: "OPTIMISTIC_ADD", task: taskC });
    expect(next.tasks).toHaveLength(3);
    expect(next.tasks[2]).toEqual({ ...taskC, status: "pending", pendingMutation: "create" });
    expect(next.tasks[0]).toBe(start.tasks[0]);
    expect(next.tasks[1]).toBe(start.tasks[1]);
  });

  it("OPTIMISTIC_TOGGLE flips completed and marks pending+toggle for the matching id only", () => {
    const start = stateWithTasks([synced(taskA), synced(taskB), synced(taskC)]);
    const next = tasksReducer(start, {
      type: "OPTIMISTIC_TOGGLE",
      id: "b",
      completed: true,
    });
    expect(next.tasks[0]).toBe(start.tasks[0]);
    expect(next.tasks[1]).toEqual({
      ...taskB,
      completed: true,
      status: "pending",
      pendingMutation: "toggle",
    });
    expect(next.tasks[2]).toBe(start.tasks[2]);
  });

  it("OPTIMISTIC_DELETE soft-deletes (task stays, marked pending+delete)", () => {
    const start = stateWithTasks([synced(taskA), synced(taskB), synced(taskC)]);
    const next = tasksReducer(start, { type: "OPTIMISTIC_DELETE", id: "b" });
    expect(next.tasks).toHaveLength(3); // length unchanged
    expect(next.tasks[1]).toEqual({
      ...taskB,
      status: "pending",
      pendingMutation: "delete",
    });
    expect(next.tasks[0]).toBe(start.tasks[0]);
    expect(next.tasks[2]).toBe(start.tasks[2]);
  });

  it("SYNC_OK for create replaces optimistic with server task, status='synced'", () => {
    const optimisticC: ClientTask = { ...taskC, createdAt: 0, status: "pending", pendingMutation: "create" };
    const serverC: Task = { ...taskC, createdAt: 1234567890 };
    const start = stateWithTasks([synced(taskA), optimisticC]);
    const next = tasksReducer(start, {
      type: "SYNC_OK",
      id: "c",
      task: serverC,
    });
    expect(next.tasks[0]).toBe(start.tasks[0]);
    expect(next.tasks[1]).toEqual({ ...serverC, status: "synced" });
    expect(next.tasks[1].pendingMutation).toBeUndefined();
  });

  it("SYNC_OK for toggle (no task) clears status to 'synced' and pendingMutation", () => {
    const pending: ClientTask = { ...taskA, completed: true, status: "pending", pendingMutation: "toggle" };
    const start = stateWithTasks([pending, synced(taskB)]);
    const next = tasksReducer(start, { type: "SYNC_OK", id: "a" });
    expect(next.tasks[0]).toEqual({ ...taskA, completed: true, status: "synced" });
    expect(next.tasks[0].pendingMutation).toBeUndefined();
    expect(next.tasks[1]).toBe(start.tasks[1]);
  });

  it("SYNC_OK for a pendingMutation='delete' task REMOVES the task", () => {
    const deleting: ClientTask = { ...taskB, status: "pending", pendingMutation: "delete" };
    const start = stateWithTasks([synced(taskA), deleting, synced(taskC)]);
    const next = tasksReducer(start, { type: "SYNC_OK", id: "b" });
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks[0]).toBe(start.tasks[0]);
    expect(next.tasks[1]).toBe(start.tasks[2]);
  });

  it("SYNC_FAIL flips status to 'failed', preserves pendingMutation", () => {
    const pending: ClientTask = { ...taskA, status: "pending", pendingMutation: "create" };
    const start = stateWithTasks([pending, synced(taskB)]);
    const next = tasksReducer(start, { type: "SYNC_FAIL", id: "a" });
    expect(next.tasks[0]).toEqual({ ...taskA, status: "failed", pendingMutation: "create" });
    expect(next.tasks[1]).toBe(start.tasks[1]);
  });

  it("RETRY flips status to 'pending', preserves pendingMutation", () => {
    const failed: ClientTask = { ...taskA, status: "failed", pendingMutation: "toggle", completed: true };
    const start = stateWithTasks([failed]);
    const next = tasksReducer(start, { type: "RETRY", id: "a" });
    expect(next.tasks[0]).toEqual({ ...taskA, completed: true, status: "pending", pendingMutation: "toggle" });
  });

  it("is pure — frozen input + double dispatch yield deep-equal output, no mutation", () => {
    const frozenInput = Object.freeze({ ...taskA, status: "synced" as const });
    const frozenState: State = Object.freeze({
      tasks: Object.freeze([frozenInput]) as readonly ClientTask[] as ClientTask[],
      isLoading: false,
      loadError: null,
    });
    const action: Action = { type: "OPTIMISTIC_TOGGLE", id: "a", completed: true };
    const out1 = tasksReducer(frozenState, action);
    const out2 = tasksReducer(frozenState, action);
    expect(out1).toEqual(out2);
    expect(frozenState.tasks[0].completed).toBe(false);
  });

  it("OPTIMISTIC_TOGGLE returns a new tasks array (immutability)", () => {
    const start = stateWithTasks([synced(taskA), synced(taskB)]);
    const prevTasksRef = start.tasks;
    const next = tasksReducer(start, {
      type: "OPTIMISTIC_TOGGLE",
      id: "a",
      completed: true,
    });
    expect(next.tasks).not.toBe(prevTasksRef);
    expect(next).not.toBe(start);
  });

  it("initial state is { tasks: [], isLoading: true, loadError: null }", () => {
    expect(initialState).toEqual({
      tasks: [],
      isLoading: true,
      loadError: null,
    });
  });
});
