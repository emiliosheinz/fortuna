"use client";

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useState } from "react";
import {
  KeyboardSafePopover,
  KeyboardSafePopoverContent,
  KeyboardSafePopoverTrigger,
} from "@/components/keyboard-safe-popover";
import { Input } from "@/components/ui/input";
import { useCreateTag, useTags } from "../hooks";
import { PALETTE_KEYS, tagColorVar } from "../tag-colors";
import type { PaletteKey } from "../types";
import { TagColorDot } from "./tag-color-dot";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
}

const PLACEHOLDER = "Pick or create tags";
const VISIBLE_CHIPS = 3;

export function TagInput({ value, onChange, id }: TagInputProps) {
  const internalId = useId();
  const triggerId = id ?? internalId;
  const tags = useTags();
  const createMutation = useCreateTag();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  async function createWithColor(name: string, color: PaletteKey) {
    await createMutation.mutateAsync({ name, color });
    add(name);
    setQuery("");
  }

  const trimmed = query.trim();
  const known = tags.data?.items ?? [];
  const colorByName = useMemo(() => {
    const map = new Map<string, PaletteKey>();
    for (const tag of known) {
      map.set(tag.name.toLowerCase(), tag.color);
    }
    return map;
  }, [known]);

  const filtered = useMemo(() => {
    if (!trimmed) return known;
    const q = trimmed.toLowerCase();
    return known.filter((t) => t.name.toLowerCase().includes(q));
  }, [known, trimmed]);

  const selectedSet = useMemo(
    () => new Set(value.map((v) => v.toLowerCase())),
    [value],
  );

  const hasExactMatch =
    trimmed.length > 0 &&
    (known.some((t) => t.name.toLowerCase() === trimmed.toLowerCase()) ||
      selectedSet.has(trimmed.toLowerCase()));
  const showCreate = trimmed.length > 0 && !hasExactMatch;

  const shownChips = value.slice(0, VISIBLE_CHIPS);
  const overflowCount = Math.max(0, value.length - VISIBLE_CHIPS);

  function add(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (selectedSet.has(clean.toLowerCase())) return;
    onChange([...value, clean]);
  }

  function remove(name: string) {
    onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()));
  }

  function toggle(name: string) {
    if (selectedSet.has(name.toLowerCase())) {
      remove(name);
      return;
    }
    add(name);
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    if (!trimmed) return;
    event.preventDefault();
    const match = known.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      toggle(match.name);
    } else {
      add(trimmed);
    }
    setQuery("");
  }

  function handleTriggerKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
    }
  }

  return (
    <div data-testid="tag-input">
      <KeyboardSafePopover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <KeyboardSafePopoverTrigger asChild>
          <div
            id={triggerId}
            role="combobox"
            tabIndex={0}
            aria-expanded={open}
            data-testid="tag-input-trigger"
            onKeyDown={handleTriggerKey}
            className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {value.length === 0 ? (
              <span className="text-muted-foreground">{PLACEHOLDER}</span>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                {shownChips.map((name) => (
                  <span
                    key={name}
                    data-testid="tag-input-chip"
                    className="inline-flex min-w-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
                  >
                    <TagColorDot
                      color={colorByName.get(name.toLowerCase()) ?? null}
                    />
                    <span className="truncate">{name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(name);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
                {overflowCount > 0 ? (
                  <span
                    data-testid="tag-input-overflow"
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    +{overflowCount} more
                  </span>
                ) : null}
              </div>
            )}
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </div>
        </KeyboardSafePopoverTrigger>
        <KeyboardSafePopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <div className="flex flex-col gap-1 p-2">
            <Input
              data-testid="tag-input-search"
              placeholder="Search tags"
              value={query}
              autoFocus={false}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKey}
            />
            <div
              data-testid="tag-input-menu"
              className="max-h-56 overflow-y-auto"
            >
              {filtered.length === 0 && !showCreate ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matches.
                </p>
              ) : null}
              {filtered.map((tag) => {
                const selected = selectedSet.has(tag.name.toLowerCase());
                return (
                  <button
                    type="button"
                    key={tag.id}
                    data-testid="tag-input-option"
                    aria-pressed={selected}
                    onClick={() => toggle(tag.name)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs border border-input">
                      {selected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <TagColorDot color={tag.color} />
                    <span className="truncate">{tag.name}</span>
                  </button>
                );
              })}
              {showCreate ? (
                <div
                  data-testid="tag-input-create"
                  className="flex flex-col gap-1.5 px-2 py-1.5 text-sm"
                >
                  <span className="text-xs text-muted-foreground">
                    Create "{trimmed}" with color
                  </span>
                  <div
                    data-testid="tag-input-create-color-picker"
                    className="flex flex-wrap gap-2"
                  >
                    {PALETTE_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={`Color ${key}`}
                        data-testid={`tag-input-create-swatch-${key}`}
                        disabled={createMutation.isPending}
                        onClick={() => createWithColor(trimmed, key)}
                        style={{ background: tagColorVar(key) }}
                        className="size-6 rounded-full outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </KeyboardSafePopoverContent>
      </KeyboardSafePopover>
    </div>
  );
}
