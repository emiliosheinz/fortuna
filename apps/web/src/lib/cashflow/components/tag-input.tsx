"use client";

import { XIcon } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useTags } from "../hooks";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
}

const SEPARATOR_RE = /[,\n]/;

export function TagInput({ value, onChange, id }: TagInputProps) {
  const internalId = useId();
  const inputId = id ?? internalId;
  const tags = useTags();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    if (!tags.data) return [];
    const q = draft.trim().toLowerCase();
    return tags.data.items
      .filter(
        (t) => !value.some((v) => v.toLowerCase() === t.name.toLowerCase()),
      )
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .slice(0, 6);
  }, [tags.data, value, draft]);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab") {
      if (draft.trim()) {
        event.preventDefault();
        add(draft);
      }
      return;
    }
    if (event.key === "Backspace" && !draft && value.length > 0) {
      const last = value[value.length - 1];
      if (last !== undefined) remove(last);
    }
  }

  function handleChange(next: string) {
    if (SEPARATOR_RE.test(next)) {
      const parts = next.split(SEPARATOR_RE);
      for (const part of parts.slice(0, -1)) add(part);
      setDraft(parts[parts.length - 1] ?? "");
      return;
    }
    setDraft(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring"
        data-testid="tag-input"
      >
        {value.map((name) => (
          <span
            key={name}
            data-testid="tag-input-chip"
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
          >
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => remove(name)}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <Input
          id={inputId}
          value={draft}
          className="h-7 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
          placeholder={value.length === 0 ? "Add tags…" : ""}
          data-testid="tag-input-draft"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 100);
            if (draft.trim()) add(draft);
          }}
          onKeyDown={handleKey}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
      {focused && suggestions.length > 0 ? (
        <div
          data-testid="tag-input-suggestions"
          className="flex flex-wrap gap-1.5"
        >
          {suggestions.map((tag) => (
            <button
              type="button"
              key={tag.id}
              onClick={() => add(tag.name)}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >
              + {tag.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
