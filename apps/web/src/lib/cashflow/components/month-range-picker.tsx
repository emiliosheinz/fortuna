"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface MonthRangeValue {
  from: string | null;
  to: string | null;
}

interface MonthRangePickerProps {
  id?: string;
  value: MonthRangeValue;
  onChange: (next: MonthRangeValue) => void;
  placeholder?: string;
  "data-testid"?: string;
}

/**
 * Trigger + popover with year/month grid for picking a YYYY-MM range. The
 * popover keeps the in-progress selection local: the parent only sees a
 * complete range, so opening the picker doesn't reset downstream queries.
 */
export function MonthRangePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a month range",
  ...rest
}: MonthRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(initialYear(value));
  const [anchor, setAnchor] = useState<string | null>(null);
  const testId = rest["data-testid"];

  useEffect(() => {
    if (!open) setAnchor(null);
  }, [open]);

  function handlePick(month: string) {
    if (!anchor) {
      setAnchor(month);
      return;
    }
    const [from, to] = anchor <= month ? [anchor, month] : [month, anchor];
    setAnchor(null);
    setOpen(false);
    onChange({ from, to });
  }

  const hasValue = Boolean(value.from || value.to);
  return (
    <div className="relative">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(initialYear(value));
        }}
      >
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
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex w-60 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Previous year"
                data-testid={testId ? `${testId}-prev-year` : undefined}
                onClick={() => setYear((y) => y - 1)}
              >
                <span aria-hidden="true">‹</span>
              </Button>
              <span className="text-sm font-medium">{year}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Next year"
                data-testid={testId ? `${testId}-next-year` : undefined}
                onClick={() => setYear((y) => y + 1)}
              >
                <span aria-hidden="true">›</span>
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_LABELS.map((label, index) => {
                const key = `${year}-${String(index + 1).padStart(2, "0")}`;
                const inRange = isInRange(key, value, anchor);
                const isEdge =
                  key === anchor ||
                  (!anchor && (key === value.from || key === value.to));
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={
                      isEdge ? "default" : inRange ? "secondary" : "ghost"
                    }
                    size="sm"
                    data-testid={
                      testId ? `${testId}-option-${index + 1}` : undefined
                    }
                    onClick={() => handlePick(key)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <p className="min-h-4 text-xs text-muted-foreground">
              {anchor ? "Pick the second month to close the range." : ""}
            </p>
          </div>
        </PopoverContent>
      </Popover>
      {hasValue ? (
        <button
          type="button"
          aria-label="Clear month range"
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

function isInRange(
  candidate: string,
  value: MonthRangeValue,
  anchor: string | null,
): boolean {
  if (anchor) return false;
  if (!value.from || !value.to) return false;
  return candidate >= value.from && candidate <= value.to;
}

function initialYear(value: MonthRangeValue): number {
  if (value.from) return Number(value.from.slice(0, 4));
  if (value.to) return Number(value.to.slice(0, 4));
  return new Date().getUTCFullYear();
}

function labelFor(value: MonthRangeValue, placeholder: string): string {
  if (value.from && value.to) {
    return `${formatMonth(value.from)} – ${formatMonth(value.to)}`;
  }
  if (value.from) return `${formatMonth(value.from)} – …`;
  if (value.to) return `… – ${formatMonth(value.to)}`;
  return placeholder;
}

function formatMonth(month: string): string {
  return format(parseISO(`${month}-01`), "LLL yyyy");
}
