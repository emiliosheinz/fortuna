"use client";

import type * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDismissKeyboardOnOpen } from "@/hooks/use-dismiss-keyboard-on-open";

type PopoverProps = React.ComponentProps<typeof Popover>;

function KeyboardSafePopover({ onOpenChange, ...props }: PopoverProps) {
  const handleOpenChange = useDismissKeyboardOnOpen(onOpenChange);
  return <Popover onOpenChange={handleOpenChange} {...props} />;
}

const KeyboardSafePopoverTrigger = PopoverTrigger;
const KeyboardSafePopoverContent = PopoverContent;

export {
  KeyboardSafePopover,
  KeyboardSafePopoverContent,
  KeyboardSafePopoverTrigger,
};
