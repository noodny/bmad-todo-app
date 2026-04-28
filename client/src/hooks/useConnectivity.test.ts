import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { useConnectivity } from "./useConnectivity";

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
};

afterEach(() => {
  setOnline(true);
});

describe("useConnectivity", () => {
  it("calls onChange synchronously with the current navigator.onLine on mount", () => {
    setOnline(false);
    const onChange = vi.fn();
    renderHook(() => useConnectivity(onChange));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("re-fires onChange on window 'online' / 'offline' events", () => {
    setOnline(true);
    const onChange = vi.fn();
    renderHook(() => useConnectivity(onChange));
    onChange.mockClear();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(onChange).toHaveBeenLastCalledWith(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("removes its listeners on unmount", () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useConnectivity(onChange));
    unmount();
    onChange.mockClear();

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("offline"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
