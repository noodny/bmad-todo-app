import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// Mock the API module BEFORE importing the hook so the hook captures the mocks.
vi.mock("@/api/apiClient", () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const apiClient = await import("@/api/apiClient");
const { useTasks, LOAD_FAIL_MESSAGE } = await import("./useTasks");

const TASK = (overrides: Partial<{ id: string; text: string; completed: boolean; createdAt: number }> = {}) => ({
  id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
  text: overrides.text ?? "alpha",
  completed: overrides.completed ?? false,
  createdAt: overrides.createdAt ?? 1,
});

beforeEach(() => {
  vi.mocked(apiClient.listTasks).mockReset();
  vi.mocked(apiClient.createTask).mockReset();
  vi.mocked(apiClient.updateTask).mockReset();
  vi.mocked(apiClient.deleteTask).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTasks initial load", () => {
  it("dispatches INITIAL_LOAD_OK and exits the loading state on success", async () => {
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([TASK()]);

    const { result } = renderHook(() => useTasks());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].status).toBe("synced");
    expect(result.current.loadError).toBeNull();
  });

  it("surfaces LOAD_FAIL_MESSAGE on a rejected fetch", async () => {
    vi.mocked(apiClient.listTasks).mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.loadError).toBe(LOAD_FAIL_MESSAGE));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tasks).toEqual([]);
  });

  it("trips the slow-load timeout and shows LOAD_FAIL_MESSAGE after 10s of silence", async () => {
    vi.useFakeTimers();
    // Never resolves — simulates a wedged backend.
    vi.mocked(apiClient.listTasks).mockImplementationOnce(() => new Promise(() => {}));

    const { result } = renderHook(() => useTasks());
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadError).toBe(LOAD_FAIL_MESSAGE);
    vi.useRealTimers();
  });

  it("retryInitialLoad reattempts and clears the error", async () => {
    vi.mocked(apiClient.listTasks)
      .mockRejectedValueOnce(new Error("first try"))
      .mockResolvedValueOnce([TASK({ text: "second-try" })]);

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loadError).toBe(LOAD_FAIL_MESSAGE));

    act(() => result.current.retryInitialLoad());

    await waitFor(() => expect(result.current.tasks[0]?.text).toBe("second-try"));
    expect(result.current.loadError).toBeNull();
  });
});

describe("useTasks mutations (optimistic + sync)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([]);
  });

  it("createTask: optimistic insert, then SYNC_OK with server task", async () => {
    const created = TASK({ id: "22222222-2222-4222-8222-222222222222", text: "from-server" });
    vi.mocked(apiClient.createTask).mockResolvedValueOnce(created);

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.createTask("user typed"));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].status).toBe("pending");

    await waitFor(() => expect(result.current.tasks[0].status).toBe("synced"));
  });

  it("toggleTask: optimistic flip, then SYNC_OK", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    vi.mocked(apiClient.listTasks).mockReset();
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([TASK({ id })]);
    vi.mocked(apiClient.updateTask).mockResolvedValueOnce({ ...TASK({ id }), completed: true });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => result.current.toggleTask(id, true));
    expect(result.current.tasks[0].completed).toBe(true);
    expect(result.current.tasks[0].status).toBe("pending");

    await waitFor(() => expect(result.current.tasks[0].status).toBe("synced"));
  });

  it("deleteTask: optimistic mark + SYNC_OK removes the row", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    vi.mocked(apiClient.listTasks).mockReset();
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([TASK({ id })]);
    vi.mocked(apiClient.deleteTask).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => result.current.deleteTask(id));
    await waitFor(() => expect(result.current.tasks).toHaveLength(0));
  });

  it("SYNC_FAIL marks status=failed and a TypeError flips online → false", async () => {
    vi.mocked(apiClient.createTask).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.createTask("oops"));
    await waitFor(() => expect(result.current.tasks[0].status).toBe("failed"));
    expect(result.current.online).toBe(false);
  });

  it("retryMutation re-runs the original mutation kind for a failed row", async () => {
    vi.mocked(apiClient.createTask)
      .mockRejectedValueOnce(new Error("transient")) // first attempt fails
      .mockResolvedValueOnce(TASK({ text: "user typed" })); // retry succeeds

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.createTask("user typed"));
    await waitFor(() => expect(result.current.tasks[0].status).toBe("failed"));

    const failedId = result.current.tasks[0].id;
    act(() => result.current.retryMutation(failedId));

    await waitFor(() => expect(result.current.tasks[0].status).toBe("synced"));
    expect(vi.mocked(apiClient.createTask)).toHaveBeenCalledTimes(2);
  });

  it("retryMutation re-runs a failed delete mutation", async () => {
    const id = "66666666-6666-4666-8666-666666666666";
    vi.mocked(apiClient.listTasks).mockReset();
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([TASK({ id })]);
    vi.mocked(apiClient.deleteTask)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => result.current.deleteTask(id));
    await waitFor(() => expect(result.current.tasks[0].status).toBe("failed"));

    act(() => result.current.retryMutation(id));
    await waitFor(() => expect(result.current.tasks).toHaveLength(0));
    expect(vi.mocked(apiClient.deleteTask)).toHaveBeenCalledTimes(2);
  });

  it("retryMutation re-runs a failed toggle mutation", async () => {
    const id = "77777777-7777-4777-8777-777777777777";
    vi.mocked(apiClient.listTasks).mockReset();
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([TASK({ id })]);
    vi.mocked(apiClient.updateTask)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ ...TASK({ id }), completed: true });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => result.current.toggleTask(id, true));
    await waitFor(() => expect(result.current.tasks[0].status).toBe("failed"));

    act(() => result.current.retryMutation(id));
    await waitFor(() => expect(result.current.tasks[0].status).toBe("synced"));
    expect(vi.mocked(apiClient.updateTask)).toHaveBeenCalledTimes(2);
  });

  it("retryMutation is a no-op for non-failed rows", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    vi.mocked(apiClient.listTasks).mockReset();
    vi.mocked(apiClient.listTasks).mockResolvedValueOnce([TASK({ id })]);

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => result.current.retryMutation(id));
    expect(vi.mocked(apiClient.createTask)).not.toHaveBeenCalled();
    expect(vi.mocked(apiClient.updateTask)).not.toHaveBeenCalled();
    expect(vi.mocked(apiClient.deleteTask)).not.toHaveBeenCalled();
  });
});
