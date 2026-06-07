"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCategories, useCreateCategory } from "../hooks";
import type { Category } from "../types";

interface CategoryComboboxProps {
  value: string | null;
  onChange: (next: string | null) => void;
  "aria-invalid"?: boolean;
  id?: string;
}

export function CategoryCombobox({
  value,
  onChange,
  id,
  ...rest
}: CategoryComboboxProps) {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => {
    if (!value || !categories.data) return null;
    return categories.data.items.find((c) => c.id === value) ?? null;
  }, [value, categories.data]);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  const filtered: Category[] = useMemo(() => {
    if (!categories.data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return categories.data.items;
    return categories.data.items.filter((c) =>
      c.name.toLowerCase().includes(q),
    );
  }, [categories.data, query]);

  const trimmed = query.trim();
  const exact = filtered.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = trimmed.length > 0 && !exact;

  function pick(cat: Category) {
    onChange(cat.id);
    setQuery(cat.name);
    setOpen(false);
    setCreateError(null);
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

  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={query}
          aria-invalid={rest["aria-invalid"]}
          aria-autocomplete="list"
          aria-expanded={open}
          placeholder="Pick or create a category"
          data-testid="category-combobox-input"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selected && e.target.value !== selected.name) {
              onChange(null);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            data-testid="category-combobox-clear"
            className="text-xs text-muted-foreground underline"
            onClick={clear}
          >
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          data-testid="category-combobox-menu"
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
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
              data-testid="category-combobox-create"
              onClick={handleCreate}
              disabled={createCategory.isPending}
              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              {createCategory.isPending ? "Creating…" : `Create "${trimmed}"`}
            </button>
          ) : null}
        </div>
      ) : null}
      {createError ? (
        <p role="alert" className="text-xs text-destructive">
          {createError}
        </p>
      ) : null}
    </div>
  );
}
