import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  useResponsiveDialogScrollIntoView,
} from "../responsive-dialog";

jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: jest.fn() }));

const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

function renderDialog() {
  return render(
    <ResponsiveDialog open onOpenChange={() => undefined}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Capture</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Add a transaction
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <input data-testid="input" />
      </ResponsiveDialogContent>
    </ResponsiveDialog>,
  );
}

describe("ResponsiveDialog", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset();
  });

  it("renders the centered Dialog on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
    expect(dialog.className).not.toMatch(/slide-in-from-bottom/);
  });

  it("renders the bottom Sheet on mobile", () => {
    useIsMobileMock.mockReturnValue(true);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
  });

  it("renders the title and description in both modes", () => {
    useIsMobileMock.mockReturnValue(true);
    renderDialog();
    expect(screen.getByText("Capture")).toBeInTheDocument();
    expect(screen.getByText("Add a transaction")).toBeInTheDocument();
  });

  it("wires keyboard-aware scroll on mobile so focused inputs scroll into view", () => {
    jest.useFakeTimers();
    try {
      useIsMobileMock.mockReturnValue(true);
      renderDialog();

      const input = screen.getByTestId("input");
      const scrollIntoView = jest.fn();
      input.scrollIntoView = scrollIntoView;

      act(() => {
        input.focus();
      });
      act(() => {
        jest.runAllTimers();
      });

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not wire keyboard-aware scroll on desktop", () => {
    jest.useFakeTimers();
    try {
      useIsMobileMock.mockReturnValue(false);
      renderDialog();

      const input = screen.getByTestId("input");
      const scrollIntoView = jest.fn();
      input.scrollIntoView = scrollIntoView;

      act(() => {
        input.focus();
      });
      act(() => {
        jest.runAllTimers();
      });

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("exposes a scrollIntoView helper that centers the target node", () => {
    useIsMobileMock.mockReturnValue(true);

    function Consumer() {
      const scrollIntoView = useResponsiveDialogScrollIntoView();
      const ref = React.useRef<HTMLDivElement>(null);
      return (
        <>
          <button
            type="button"
            data-testid="scroll-trigger"
            onClick={() => scrollIntoView(ref.current)}
          >
            scroll
          </button>
          <div data-testid="error" ref={ref}>
            error
          </div>
        </>
      );
    }

    render(
      <ResponsiveDialog open onOpenChange={() => undefined}>
        <ResponsiveDialogContent>
          <Consumer />
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );

    const error = screen.getByTestId("error");
    const scrollIntoView = jest.fn();
    error.scrollIntoView = scrollIntoView;

    act(() => {
      screen.getByTestId("scroll-trigger").click();
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
  });

  it("scrollIntoView helper is a no-op when the node is null", () => {
    useIsMobileMock.mockReturnValue(false);

    function Consumer() {
      const scrollIntoView = useResponsiveDialogScrollIntoView();
      return (
        <button
          type="button"
          data-testid="scroll-trigger"
          onClick={() => scrollIntoView(null)}
        >
          scroll
        </button>
      );
    }

    render(
      <ResponsiveDialog open onOpenChange={() => undefined}>
        <ResponsiveDialogContent>
          <Consumer />
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );

    expect(() => screen.getByTestId("scroll-trigger").click()).not.toThrow();
  });
});
