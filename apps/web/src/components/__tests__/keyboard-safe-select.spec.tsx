import { render, screen } from "@testing-library/react";
import type * as React from "react";

jest.mock("@/components/ui/select", () => {
  const onOpenChangeBridge: { current: ((open: boolean) => void) | null } = {
    current: null,
  };
  return {
    __esModule: true,
    __onOpenChangeBridge: onOpenChangeBridge,
    Select: ({
      onOpenChange,
      children,
    }: {
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
    }) => {
      onOpenChangeBridge.current = onOpenChange ?? null;
      return <div data-testid="mock-select">{children}</div>;
    },
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
      <button type="button" data-testid="mock-trigger">
        {children}
      </button>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectGroup: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectLabel: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectSeparator: () => <hr />,
    SelectValue: () => <span>value</span>,
  };
});

import * as SelectModule from "@/components/ui/select";
import {
  KeyboardSafeSelect,
  KeyboardSafeSelectContent,
  KeyboardSafeSelectItem,
  KeyboardSafeSelectTrigger,
  KeyboardSafeSelectValue,
} from "../keyboard-safe-select";

const bridge = (
  SelectModule as unknown as {
    __onOpenChangeBridge: { current: ((open: boolean) => void) | null };
  }
).__onOpenChangeBridge;

beforeEach(() => {
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  bridge.current = null;
});

afterEach(() => {
  jest.restoreAllMocks();
});

function Probe({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <div>
      <input data-testid="outside-input" />
      <KeyboardSafeSelect onOpenChange={onOpenChange}>
        <KeyboardSafeSelectTrigger>
          <KeyboardSafeSelectValue />
        </KeyboardSafeSelectTrigger>
        <KeyboardSafeSelectContent>
          <KeyboardSafeSelectItem value="usd">USD</KeyboardSafeSelectItem>
        </KeyboardSafeSelectContent>
      </KeyboardSafeSelect>
    </div>
  );
}

describe("KeyboardSafeSelect", () => {
  it("blurs the active element when Radix announces an open transition", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} />);

    const input = screen.getByTestId("outside-input") as HTMLInputElement;
    const blurSpy = jest.spyOn(input, "blur");
    input.focus();
    expect(document.activeElement).toBe(input);

    expect(bridge.current).not.toBeNull();
    bridge.current?.(true);

    expect(blurSpy).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("passes the close transition through unchanged", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} />);

    bridge.current?.(false);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("forwards children through to the underlying Select", () => {
    render(<Probe />);
    expect(screen.getByTestId("mock-trigger")).toBeInTheDocument();
  });
});
