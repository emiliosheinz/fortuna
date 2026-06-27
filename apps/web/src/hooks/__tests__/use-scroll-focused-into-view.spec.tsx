import { act, render, screen } from "@testing-library/react";
import { useScrollFocusedIntoView } from "../use-scroll-focused-into-view";

function Probe({ enabled = true }: { enabled?: boolean }) {
  const setContainer = useScrollFocusedIntoView(enabled);
  return (
    <div ref={setContainer} data-testid="container">
      <input data-testid="input" />
      <textarea data-testid="textarea" />
      <button type="button" data-testid="button">
        button
      </button>
    </div>
  );
}

describe("useScrollFocusedIntoView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("scrolls a focused input into view after the keyboard animation settles", () => {
    render(<Probe />);
    const input = screen.getByTestId("input");
    const scrollIntoView = jest.fn();
    input.scrollIntoView = scrollIntoView;

    act(() => {
      input.focus();
    });
    expect(scrollIntoView).not.toHaveBeenCalled();

    act(() => {
      jest.runAllTimers();
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
  });

  it("scrolls a focused textarea into view", () => {
    render(<Probe />);
    const textarea = screen.getByTestId("textarea");
    const scrollIntoView = jest.fn();
    textarea.scrollIntoView = scrollIntoView;

    act(() => {
      textarea.focus();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("ignores focus on elements that are not inputs or textareas", () => {
    render(<Probe />);
    const button = screen.getByTestId("button");
    const scrollIntoView = jest.fn();
    button.scrollIntoView = scrollIntoView;

    act(() => {
      button.focus();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    render(<Probe enabled={false} />);
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
  });

  it("cancels a pending scroll when focus moves before it fires", () => {
    render(<Probe />);
    const input = screen.getByTestId("input");
    const textarea = screen.getByTestId("textarea");
    const inputScroll = jest.fn();
    const textareaScroll = jest.fn();
    input.scrollIntoView = inputScroll;
    textarea.scrollIntoView = textareaScroll;

    act(() => {
      input.focus();
    });
    act(() => {
      textarea.focus();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(inputScroll).not.toHaveBeenCalled();
    expect(textareaScroll).toHaveBeenCalledTimes(1);
  });

  it("does not scroll after the container unmounts", () => {
    const { unmount } = render(<Probe />);
    const input = screen.getByTestId("input");
    const scrollIntoView = jest.fn();
    input.scrollIntoView = scrollIntoView;

    act(() => {
      input.focus();
    });
    unmount();
    act(() => {
      jest.runAllTimers();
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
