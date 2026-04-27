import { describe, it, expect } from "vitest";
import type { Task } from "@/api/types";
import {
  initialState,
  tasksReducer,
  type Action,
  type State,
} from "./tasksReducer";

const taskA: Task = { id: "a", text: "alpha", completed: false, createdAt: 1 };
const taskB: Task = { id: "b", text: "bravo", completed: false, createdAt: 2 };
const taskC: Task = { id: "c", text: "charlie", completed: true, createdAt: 3 };

const stateWithTasks = (tasks: Task[]): State => ({
  tasks,
  isLoading: false,
  loadError: null,
});

describe("tasksReducer", () => {
  it("INITIAL_LOAD_OK populates tasks and clears loading + error", () => {
    const start: State = { tasks: [], isLoading: true, loadError: "stale" };
    const next = tasksReducer(start, {
      type: "INITIAL_LOAD_OK",
      tasks: [taskA, taskB],
    });
    expect(next).toEqual({
      tasks: [taskA, taskB],
      isLoading: false,
      loadError: null,
    });
  });

  it("INITIAL_LOAD_FAIL sets loadError, clears loading, preserves tasks", () => {
    const start = stateWithTasks([taskA]);
    const next = tasksReducer(start, {
      type: "INITIAL_LOAD_FAIL",
      message: "boom",
    });
    expect(next).toEqual({
      tasks: [taskA],
      isLoading: false,
      loadError: "boom",
    });
  });

  it("INITIAL_LOAD_RETRY sets loading, clears error, preserves tasks", () => {
    const prevTasks: Task[] = [];
    const start = Object.freeze({
      tasks: prevTasks,
      isLoading: false,
      loadError: "Could not load tasks.",
    }) as State;
    const next = tasksReducer(start, { type: "INITIAL_LOAD_RETRY" });
    expect(next.isLoading).toBe(true);
    expect(next.loadError).toBeNull();
    expect(next.tasks).toBe(prevTasks); // reference unchanged
    expect(next).not.toBe(start); // new state object
  });

  it("OPTIMISTIC_ADD appends to tasks (newest at the bottom)", () => {
    const start = stateWithTasks([taskA, taskB]);
    const next = tasksReducer(start, { type: "OPTIMISTIC_ADD", task: taskC });
    expect(next.tasks).toHaveLength(3);
    expect(next.tasks[2]).toBe(taskC);
    expect(next.tasks[0]).toBe(taskA);
    expect(next.tasks[1]).toBe(taskB);
  });

  it("OPTIMISTIC_TOGGLE flips completed for the matching id only", () => {
    const start = stateWithTasks([taskA, taskB, taskC]);
    const next = tasksReducer(start, {
      type: "OPTIMISTIC_TOGGLE",
      id: "b",
      completed: true,
    });
    expect(next.tasks[0]).toBe(taskA); // untouched — same reference
    expect(next.tasks[1]).not.toBe(taskB); // toggled — new object
    expect(next.tasks[1]).toEqual({ ...taskB, completed: true });
    expect(next.tasks[2]).toBe(taskC); // untouched
  });

  it("OPTIMISTIC_DELETE removes the matching task and preserves order", () => {
    const start = stateWithTasks([taskA, taskB, taskC]);
    const next = tasksReducer(start, { type: "OPTIMISTIC_DELETE", id: "b" });
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks[0]).toBe(taskA);
    expect(next.tasks[1]).toBe(taskC);
  });

  it("SYNC_OK with task replaces the optimistic placeholder", () => {
    const optimisticC: Task = { ...taskC, createdAt: 0 };
    const serverC: Task = { ...taskC, createdAt: 1234567890 };
    const start = stateWithTasks([taskA, optimisticC]);
    const next = tasksReducer(start, {
      type: "SYNC_OK",
      id: "c",
      task: serverC,
    });
    expect(next.tasks[0]).toBe(taskA); // untouched
    expect(next.tasks[1]).toEqual(serverC);
  });

  it("SYNC_OK without task is a no-op (returns same state reference)", () => {
    const start = stateWithTasks([taskA, taskB]);
    const next = tasksReducer(start, { type: "SYNC_OK", id: "a" });
    expect(next).toBe(start);
  });

  it("ROLLBACK restores tasks to the previousTasks snapshot", () => {
    const previous = [taskA, taskB];
    const start = stateWithTasks([taskA, taskB, taskC]); // mid-flight extra task
    const next = tasksReducer(start, {
      type: "ROLLBACK",
      previousTasks: previous,
    });
    expect(next.tasks).toBe(previous);
    expect(next.isLoading).toBe(false);
    expect(next.loadError).toBeNull();
  });

  it("is pure — frozen input + double dispatch yield deep-equal output, no mutation", () => {
    const frozenState: State = Object.freeze({
      tasks: Object.freeze([Object.freeze({ ...taskA })]) as readonly Task[] as Task[],
      isLoading: false,
      loadError: null,
    });
    const action: Action = { type: "OPTIMISTIC_TOGGLE", id: "a", completed: true };

    // A mutating reducer would throw on frozen input in strict mode (ESM
    // is strict by default).
    const out1 = tasksReducer(frozenState, action);
    const out2 = tasksReducer(frozenState, action);

    expect(out1).toEqual(out2);
    expect(frozenState.tasks[0].completed).toBe(false);
  });

  it("OPTIMISTIC_TOGGLE returns a new tasks array (immutability)", () => {
    const start = stateWithTasks([taskA, taskB]);
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
