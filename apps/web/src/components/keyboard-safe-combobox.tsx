"use client";

import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import {
  KeyboardSafePopover,
  KeyboardSafePopoverContent,
  KeyboardSafePopoverTrigger,
} from "@/components/keyboard-safe-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories, useCreateCategory } from "@/lib/cashflow/hooks";
import type { Category } from "@/lib/cashflow/types";
import { cn } from "@/lib/utils";

interface KeyboardSafeComboboxProps {
  value: string | null;
  onChange: (next: string | null) => void;
  id?: string;
  "aria-invalid"?: boolean;
}

const PLACEHOLDER = "Pick or create a category";

export function KeyboardSafeCombobox({
  value,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
}: KeyboardSafeComboboxProps) {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  const selected = React.useMemo(() => {
    if (!value || !categories.data) return null;
    return categories.data.items.find((c) => c.id === value) ?? null;
  }, [value, categories.data]);

  const trimmed = query.trim();
  const filtered: Category[] = React.useMemo(() => {
    if (!categories.data) return [];
    const q = trimmed.toLowerCase();
    if (!q) return categories.data.items;
    return categories.data.items.filter((c) =>
      c.name.toLowerCase().includes(q),
    );
  }, [categories.data, trimmed]);

  const exact = filtered.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = trimmed.length > 0 && !exact;

  function reset() {
    setQuery("");
    setCreateError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function pick(cat: Category) {
    onChange(cat.id);
    close();
  }

  async function handleCreate() {
    if (!trimmed) return;
    setCreateError(null);
    try {
      const result = await createCategory.mutateAsync(trimmed);
      pick(result.category);
    } catch {
      setCreateError("Could not create category. Try again.");
    }
  }

  return (
    <div className="relative">
      <KeyboardSafePopover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <KeyboardSafePopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            data-testid="keyboard-safe-combobox-trigger"
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              selected && "pr-9",
            )}
          >
            <span className="truncate">{selected?.name ?? PLACEHOLDER}</span>
            {selected ? null : (
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            )}
          </Button>
        </KeyboardSafePopoverTrigger>
        <KeyboardSafePopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <div className="flex flex-col gap-1 p-2">
            <Input
              data-testid="keyboard-safe-combobox-search"
              placeholder="Search categories"
              value={query}
              autoFocus={false}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div
              data-testid="keyboard-safe-combobox-menu"
              className="max-h-56 overflow-y-auto"
            >
              {filtered.length === 0 && !showCreate ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matches.
                </p>
              ) : null}
              {filtered.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => pick(cat)}
                  className={cn(
                    "block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    value === cat.id ? "bg-accent" : null,
                  )}
                >
                  {cat.name}
                </button>
              ))}
              {showCreate ? (
                <button
                  type="button"
                  data-testid="keyboard-safe-combobox-create"
                  onClick={handleCreate}
                  disabled={createCategory.isPending}
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  {createCategory.isPending
                    ? "Creating…"
                    : `Create "${trimmed}"`}
                </button>
              ) : null}
            </div>
            {createError ? (
              <p role="alert" className="px-2 text-xs text-destructive">
                {createError}
              </p>
            ) : null}
          </div>
        </KeyboardSafePopoverContent>
      </KeyboardSafePopover>
      {selected ? (
        <button
          type="button"
          aria-label="Clear category"
          data-testid="keyboard-safe-combobox-clear"
          onClick={() => onChange(null)}
          className="absolute top-1/2 right-2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
