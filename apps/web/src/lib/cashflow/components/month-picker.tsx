"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
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

interface MonthPickerProps {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  "data-testid"?: string;
}

/** Trigger + popover with year/month grid for picking a YYYY-MM value. */
export function MonthPicker({
  id,
  value,
  onChange,
  placeholder = "Pick a month",
  clearable = false,
  ...rest
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(initialYear(value));
  const testId = rest["data-testid"];
  const showClear = clearable && Boolean(value);

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
              !value && "text-muted-foreground",
              showClear && "pr-9",
            )}
          >
            <CalendarIcon className="size-4" />
            <span className="flex-1 truncate">
              {value
                ? format(parseISO(`${value}-01`), "LLLL yyyy")
                : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-2">
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
              <span
                className="text-sm font-medium"
                data-testid={testId ? `${testId}-year-label` : undefined}
              >
                {year}
              </span>
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
                const selected = key === value;
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={selected ? "default" : "ghost"}
                    size="sm"
                    data-testid={
                      testId ? `${testId}-option-${index + 1}` : undefined
                    }
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {showClear ? (
        <button
          type="button"
          aria-label="Clear month"
          data-testid={testId ? `${testId}-clear` : undefined}
          onClick={() => onChange(null)}
          className="absolute inset-y-0 right-2 my-auto flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function initialYear(value: string | null): number {
  if (value) {
    const parsed = Number(value.slice(0, 4));
    if (Number.isFinite(parsed)) return parsed;
  }
  return new Date().getUTCFullYear();
}
