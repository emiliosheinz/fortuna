import * as React from "react";

type OpenChange = (open: boolean) => void;

export function useDismissKeyboardOnOpen(
  onOpenChange?: OpenChange,
): OpenChange {
  return React.useCallback(
    (open) => {
      if (!open) {
        onOpenChange?.(false);
        return;
      }

      if (typeof document !== "undefined") {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }

      const apply = () => onOpenChange?.(true);
      if (
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        window.requestAnimationFrame(apply);
      } else {
        apply();
      }
    },
    [onOpenChange],
  );
}
