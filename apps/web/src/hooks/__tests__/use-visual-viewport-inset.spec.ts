import { act, renderHook } from "@testing-library/react";
import { useVisualViewportInset } from "../use-visual-viewport-inset";

type Listener = (event: Event) => void;

type FakeVisualViewport = {
  height: number;
  offsetTop: number;
  listeners: Map<string, Set<Listener>>;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  dispatchEvent: (type: string) => void;
};

const originalInnerHeight = window.innerHeight;

function installVisualViewport(initial: {
  height: number;
  offsetTop: number;
  innerHeight: number;
}): FakeVisualViewport {
  const listeners = new Map<string, Set<Listener>>();
  const viewport: FakeVisualViewport = {
    height: initial.height,
    offsetTop: initial.offsetTop,
    listeners,
    addEventListener: jest.fn((type: string, listener: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    }),
    removeEventListener: jest.fn((type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatchEvent(type: string) {
      const event = new Event(type);
      listeners.get(type)?.forEach((listener) => {
        listener(event);
      });
    },
  };

  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: initial.innerHeight,
    writable: true,
  });

  return viewport;
}

function uninstallVisualViewport() {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: originalInnerHeight,
    writable: true,
  });
}

describe("useVisualViewportInset", () => {
  afterEach(() => {
    uninstallVisualViewport();
  });

  it("returns 0 when window.visualViewport is unavailable", () => {
    uninstallVisualViewport();
    const { result } = renderHook(() => useVisualViewportInset());
    expect(result.current).toBe(0);
  });

  it("reports the bottom inset from the current visualViewport on mount", () => {
    installVisualViewport({ height: 500, offsetTop: 0, innerHeight: 800 });

    const { result } = renderHook(() => useVisualViewportInset());

    expect(result.current).toBe(300);
  });

  it("clamps a negative inset to 0", () => {
    installVisualViewport({ height: 900, offsetTop: 0, innerHeight: 800 });

    const { result } = renderHook(() => useVisualViewportInset());

    expect(result.current).toBe(0);
  });

  it("updates the inset when the visualViewport resizes", () => {
    const viewport = installVisualViewport({
      height: 800,
      offsetTop: 0,
      innerHeight: 800,
    });

    const { result } = renderHook(() => useVisualViewportInset());
    expect(result.current).toBe(0);

    act(() => {
      viewport.height = 480;
      viewport.dispatchEvent("resize");
    });

    expect(result.current).toBe(320);
  });

  it("updates the inset when the visualViewport scrolls", () => {
    const viewport = installVisualViewport({
      height: 500,
      offsetTop: 0,
      innerHeight: 800,
    });

    const { result } = renderHook(() => useVisualViewportInset());
    expect(result.current).toBe(300);

    act(() => {
      viewport.offsetTop = 100;
      viewport.dispatchEvent("scroll");
    });

    expect(result.current).toBe(200);
  });

  it("removes its listeners on unmount", () => {
    const viewport = installVisualViewport({
      height: 500,
      offsetTop: 0,
      innerHeight: 800,
    });

    const { unmount } = renderHook(() => useVisualViewportInset());
    unmount();

    expect(viewport.removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(viewport.removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });
});
