import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "./apiClient";

const ID = "11111111-1111-4111-8111-111111111111";
const TASK = { id: ID, text: "buy bread", completed: false, createdAt: 1 };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const okResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const failResponse = (status: number) =>
  ({ ok: false, status, json: () => Promise.resolve({}) }) as unknown as Response;

describe("apiClient.listTasks", () => {
  it("GETs /api/tasks and returns the parsed array", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([TASK]));

    const tasks = await listTasks();

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", { signal: undefined });
    expect(tasks).toEqual([TASK]);
  });

  it("forwards the optional AbortSignal", async () => {
    const ctrl = new AbortController();
    fetchMock.mockResolvedValueOnce(okResponse([]));

    await listTasks(ctrl.signal);

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", { signal: ctrl.signal });
  });

  it("throws on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(failResponse(500));
    await expect(listTasks()).rejects.toThrow(/GET \/api\/tasks failed: 500/);
  });
});

describe("apiClient.createTask", () => {
  it("POSTs JSON body and returns the created task", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(TASK));

    const result = await createTask({ id: ID, text: "buy bread" });

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ID, text: "buy bread" }),
    });
    expect(result).toEqual(TASK);
  });

  it("throws on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(failResponse(400));
    await expect(createTask({ id: ID, text: "x" })).rejects.toThrow(
      /POST \/api\/tasks failed: 400/,
    );
  });
});

describe("apiClient.updateTask", () => {
  it("PATCHes the right URL with completed flag", async () => {
    const patched = { ...TASK, completed: true };
    fetchMock.mockResolvedValueOnce(okResponse(patched));

    const result = await updateTask(ID, { completed: true });

    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(result.completed).toBe(true);
  });

  it("throws on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(failResponse(404));
    await expect(updateTask(ID, { completed: true })).rejects.toThrow(
      new RegExp(`PATCH /api/tasks/${ID} failed: 404`),
    );
  });
});

describe("apiClient.deleteTask", () => {
  it("DELETEs the right URL and resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 } as Response);

    await expect(deleteTask(ID)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${ID}`, {
      method: "DELETE",
    });
  });

  it("throws on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(failResponse(500));
    await expect(deleteTask(ID)).rejects.toThrow(
      new RegExp(`DELETE /api/tasks/${ID} failed: 500`),
    );
  });
});
