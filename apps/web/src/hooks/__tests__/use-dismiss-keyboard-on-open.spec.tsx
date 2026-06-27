import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { useDismissKeyboardOnOpen } from "../use-dismiss-keyboard-on-open";

type ProbeProps = {
  onOpenChange?: (open: boolean) => void;
  initialOpen?: boolean;
};

function Probe({ onOpenChange, initialOpen = false }: ProbeProps) {
  const [open, setOpen] = React.useState(initialOpen);
  const handleOpenChange = useDismissKeyboardOnOpen((next) => {
    setOpen(next);
    onOpenChange?.(next);
  });
  return (
    <div>
      <input data-testid="input" />
      <button
        type="button"
        data-testid="open"
        onClick={() => handleOpenChange(true)}
      >
        open
      </button>
      <button
        type="button"
        data-testid="close"
        onClick={() => handleOpenChange(false)}
      >
        close
      </button>
      <output data-testid="state">{open ? "open" : "closed"}</output>
    </div>
  );
}

describe("useDismissKeyboardOnOpen", () => {
  let rafSpy: jest.SpyInstance;

  beforeEach(() => {
    rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  it("blurs the active element before propagating an open transition", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} />);

    const input = screen.getByTestId("input") as HTMLInputElement;
    const blurSpy = jest.spyOn(input, "blur");

    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);

    act(() => {
      screen.getByTestId("open").click();
    });

    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("defers the open transition via requestAnimationFrame", () => {
    const onOpenChange = jest.fn();
    const calls: string[] = [];
    rafSpy.mockImplementation((cb: FrameRequestCallback) => {
      calls.push("rAF");
      cb(0);
      return 0;
    });

    render(<Probe onOpenChange={(next) => onOpenChange(next)} />);

    act(() => {
      screen.getByTestId("open").click();
    });

    expect(calls).toEqual(["rAF"]);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("does not blur or defer when the transition is to closed", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} initialOpen={true} />);

    const input = screen.getByTestId("input") as HTMLInputElement;
    const blurSpy = jest.spyOn(input, "blur");

    act(() => {
      input.focus();
    });
    rafSpy.mockClear();

    act(() => {
      screen.getByTestId("close").click();
    });

    expect(blurSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("ignores activeElement when there is nothing to blur", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} />);

    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    act(() => {
      screen.getByTestId("open").click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("falls back to a synchronous call when requestAnimationFrame is missing", () => {
    rafSpy.mockRestore();
    const originalRaf = window.requestAnimationFrame;
    // @ts-expect-error - simulate environments without rAF
    delete window.requestAnimationFrame;
    try {
      const onOpenChange = jest.fn();
      render(<Probe onOpenChange={onOpenChange} />);

      act(() => {
        screen.getByTestId("open").click();
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
  });
});
