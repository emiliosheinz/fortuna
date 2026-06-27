"use client";

import type * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDismissKeyboardOnOpen } from "@/hooks/use-dismiss-keyboard-on-open";

type SelectProps = React.ComponentProps<typeof Select>;

function KeyboardSafeSelect({ onOpenChange, ...props }: SelectProps) {
  const handleOpenChange = useDismissKeyboardOnOpen(onOpenChange);
  return <Select onOpenChange={handleOpenChange} {...props} />;
}

const KeyboardSafeSelectTrigger = SelectTrigger;
const KeyboardSafeSelectContent = SelectContent;
const KeyboardSafeSelectItem = SelectItem;
const KeyboardSafeSelectGroup = SelectGroup;
const KeyboardSafeSelectLabel = SelectLabel;
const KeyboardSafeSelectSeparator = SelectSeparator;
const KeyboardSafeSelectValue = SelectValue;

export {
  KeyboardSafeSelect,
  KeyboardSafeSelectContent,
  KeyboardSafeSelectGroup,
  KeyboardSafeSelectItem,
  KeyboardSafeSelectLabel,
  KeyboardSafeSelectSeparator,
  KeyboardSafeSelectTrigger,
  KeyboardSafeSelectValue,
};
