import * as React from "react";

const KEYBOARD_SETTLE_MS = 250;

function isEditable(node: EventTarget | null): node is HTMLElement {
  return (
    node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
  );
}

export function useScrollFocusedIntoView(
  enabled = true,
): (node: HTMLElement | null) => void {
  const cleanupRef = React.useRef<(() => void) | null>(null);

  return React.useCallback(
    (node: HTMLElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!enabled || !node) return;

      let timer: ReturnType<typeof setTimeout> | null = null;
      const cancel = () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const handleFocusIn = (event: FocusEvent) => {
        const target = event.target;
        if (!isEditable(target)) return;
        cancel();
        timer = setTimeout(() => {
          timer = null;
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }, KEYBOARD_SETTLE_MS);
      };

      node.addEventListener("focusin", handleFocusIn);
      cleanupRef.current = () => {
        node.removeEventListener("focusin", handleFocusIn);
        cancel();
      };
    },
    [enabled],
  );
}
