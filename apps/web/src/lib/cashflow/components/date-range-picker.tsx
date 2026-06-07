"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRangeValue {
  from: string | null;
  to: string | null;
}

interface DateRangePickerProps {
  id?: string;
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  placeholder?: string;
  "data-testid"?: string;
}

/** Shadcn Calendar in range mode wrapped in a trigger + popover. */
export function DateRangePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date range",
  ...rest
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const testId = rest["data-testid"];
  const range: DateRange | undefined = toDateRange(value);
  const hasValue = Boolean(value.from || value.to);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            data-testid={testId}
            className={cn(
              "w-full justify-start text-left font-normal",
              !hasValue && "text-muted-foreground",
              hasValue && "pr-9",
            )}
          >
            <CalendarIcon className="size-4" />
            <span className="flex-1 truncate">
              {labelFor(value, placeholder)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={(next) => {
              onChange({
                from: next?.from ? format(next.from, "yyyy-MM-dd") : null,
                to: next?.to ? format(next.to, "yyyy-MM-dd") : null,
              });
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {hasValue ? (
        <button
          type="button"
          aria-label="Clear date range"
          data-testid={testId ? `${testId}-clear` : undefined}
          onClick={() => onChange({ from: null, to: null })}
          className="absolute inset-y-0 right-2 my-auto flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function toDateRange(value: DateRangeValue): DateRange | undefined {
  const from = value.from ? parseISO(value.from) : undefined;
  const to = value.to ? parseISO(value.to) : undefined;
  if (!from && !to) return undefined;
  return { from, to };
}

function labelFor(value: DateRangeValue, placeholder: string): string {
  if (value.from && value.to) {
    return `${format(parseISO(value.from), "PP")} – ${format(parseISO(value.to), "PP")}`;
  }
  if (value.from) return `${format(parseISO(value.from), "PP")} – …`;
  if (value.to) return `… – ${format(parseISO(value.to), "PP")}`;
  return placeholder;
}
