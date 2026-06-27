import { fireEvent, render, screen } from "@testing-library/react";
import {
  KeyboardSafePopover,
  KeyboardSafePopoverContent,
  KeyboardSafePopoverTrigger,
} from "../keyboard-safe-popover";

beforeEach(() => {
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function Probe({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <div>
      <input data-testid="outside-input" />
      <KeyboardSafePopover onOpenChange={onOpenChange}>
        <KeyboardSafePopoverTrigger data-testid="trigger">
          open
        </KeyboardSafePopoverTrigger>
        <KeyboardSafePopoverContent data-testid="content">
          inside
        </KeyboardSafePopoverContent>
      </KeyboardSafePopover>
    </div>
  );
}

describe("KeyboardSafePopover", () => {
  it("blurs the active element before reporting the open transition", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} />);

    const input = screen.getByTestId("outside-input") as HTMLInputElement;
    const blurSpy = jest.spyOn(input, "blur");
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.click(screen.getByTestId("trigger"));

    expect(blurSpy).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("passes the close transition through unchanged", () => {
    const onOpenChange = jest.fn();
    render(<Probe onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId("trigger"));
    onOpenChange.mockClear();
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
