"use client";

import { format, parseISO } from "date-fns";
import {
  CalendarRangeIcon,
  ChevronDownIcon,
  HashIcon,
  ListFilterIcon,
  SearchIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCategories, useTags } from "../hooks";
import type { TransactionKind } from "../types";
import { DateRangePicker } from "./date-range-picker";

export interface TransactionFilterState {
  from: string | null;
  to: string | null;
  categoryId: string | null;
  tagId: string | null;
  kind: TransactionKind | null;
  q: string | null;
}

interface TransactionFilterBarProps {
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
}

type FilterKey = "date" | "category" | "tag" | "kind";

const FILTER_LABELS: Record<FilterKey, string> = {
  date: "Date range",
  category: "Category",
  tag: "Tag",
  kind: "Kind",
};

const FILTER_ICONS: Record<FilterKey, typeof CalendarRangeIcon> = {
  date: CalendarRangeIcon,
  category: WalletIcon,
  tag: HashIcon,
  kind: ListFilterIcon,
};

export function TransactionFilterBar({
  value,
  onChange,
}: TransactionFilterBarProps) {
  const [autoOpen, setAutoOpen] = useState<FilterKey | null>(null);
  const active = activeFilters(value);
  const unused = (Object.keys(FILTER_LABELS) as FilterKey[]).filter(
    (key) => !active.includes(key),
  );

  function reset(...keys: FilterKey[]) {
    const next = { ...value };
    for (const key of keys) {
      if (key === "date") {
        next.from = null;
        next.to = null;
      } else if (key === "category") {
        next.categoryId = null;
      } else if (key === "tag") {
        next.tagId = null;
      } else if (key === "kind") {
        next.kind = null;
      }
    }
    onChange(next);
  }

  return (
    <div data-testid="transaction-filter-bar" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="transaction-filter-add"
              disabled={unused.length === 0}
            >
              <ListFilterIcon className="size-4" />
              Add filter
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {unused.map((key) => {
              const Icon = FILTER_ICONS[key];
              return (
                <DropdownMenuItem
                  key={key}
                  data-testid={`transaction-filter-add-${key}`}
                  onSelect={() => setAutoOpen(key)}
                >
                  <Icon className="size-4 opacity-70" />
                  {FILTER_LABELS[key]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1 min-w-48">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            data-testid="transaction-filter-q"
            value={value.q ?? ""}
            onChange={(e) => onChange({ ...value, q: e.target.value || null })}
            placeholder="Search description"
            className="pl-9"
          />
        </div>

        {active.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="transaction-filter-clear"
            onClick={() =>
              onChange({
                from: null,
                to: null,
                categoryId: null,
                tagId: null,
                kind: null,
                q: null,
              })
            }
          >
            Clear all
          </Button>
        ) : null}
      </div>

      {active.length > 0 || autoOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((key) => (
            <FilterChip
              key={key}
              filter={key}
              value={value}
              onChange={onChange}
              onRemove={() => reset(key)}
              openInitially={autoOpen === key}
              onOpenHandled={() => setAutoOpen(null)}
            />
          ))}
          {autoOpen && !active.includes(autoOpen) ? (
            <FilterChip
              key={`pending-${autoOpen}`}
              filter={autoOpen}
              value={value}
              onChange={onChange}
              onRemove={() => setAutoOpen(null)}
              openInitially
              pending
              onOpenHandled={() => setAutoOpen(null)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface FilterChipProps {
  filter: FilterKey;
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
  onRemove: () => void;
  openInitially?: boolean;
  pending?: boolean;
  onOpenHandled?: () => void;
}

function FilterChip({
  filter,
  value,
  onChange,
  onRemove,
  openInitially,
  pending,
  onOpenHandled,
}: FilterChipProps) {
  const [open, setOpen] = useState(Boolean(openInitially));
  const Icon = FILTER_ICONS[filter];
  const categories = useCategories();
  const tags = useTags();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) onOpenHandled?.();
  }

  const summary = summaryFor(filter, value, pending, {
    categoryName:
      categories.data?.items.find((c) => c.id === value.categoryId)?.name ??
      null,
    tagName: tags.data?.items.find((t) => t.id === value.tagId)?.name ?? null,
  });

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div
        data-testid={`transaction-filter-chip-${filter}`}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-background pl-2 text-xs"
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={`transaction-filter-chip-${filter}-trigger`}
            className="inline-flex items-center gap-1.5 py-1 pr-1"
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{FILTER_LABELS[filter]}</span>
            <span className="text-muted-foreground">{summary}</span>
          </button>
        </PopoverTrigger>
        <button
          type="button"
          aria-label={`Remove ${FILTER_LABELS[filter]} filter`}
          data-testid={`transaction-filter-chip-${filter}-remove`}
          onClick={onRemove}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-3" />
        </button>
      </div>
      <PopoverContent className="w-auto p-3" align="start">
        <FilterEditor
          filter={filter}
          value={value}
          onChange={onChange}
          onApplied={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilterEditor({
  filter,
  value,
  onChange,
  onApplied,
}: {
  filter: FilterKey;
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
  onApplied: () => void;
}) {
  if (filter === "date") {
    return (
      <DateRangePicker
        value={{ from: value.from, to: value.to }}
        data-testid="transaction-filter-date-editor"
        onChange={(next) => {
          onChange({ ...value, from: next.from, to: next.to });
        }}
      />
    );
  }
  if (filter === "category") {
    return (
      <CategoryEditor
        value={value.categoryId}
        onChange={(next) => {
          onChange({ ...value, categoryId: next });
          if (next) onApplied();
        }}
      />
    );
  }
  if (filter === "tag") {
    return (
      <TagEditor
        value={value.tagId}
        onChange={(next) => {
          onChange({ ...value, tagId: next });
          if (next) onApplied();
        }}
      />
    );
  }
  return (
    <KindEditor
      value={value.kind}
      onChange={(next) => {
        onChange({ ...value, kind: next });
        if (next) onApplied();
      }}
    />
  );
}

function CategoryEditor({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const categories = useCategories();
  const [search, setSearch] = useState("");
  const items = (categories.data?.items ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="flex w-56 flex-col gap-2">
      <Input
        type="search"
        placeholder="Category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <ul className="max-h-60 overflow-y-auto">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              data-testid={`transaction-filter-category-option-${c.id}`}
              className={chipOptionClass(value === c.id)}
              onClick={() => onChange(c.id)}
            >
              {c.name}
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            No categories.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TagEditor({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const tags = useTags();
  const [search, setSearch] = useState("");
  const items = (tags.data?.items ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="flex w-56 flex-col gap-2">
      <Input
        type="search"
        placeholder="Tag…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <ul className="max-h-60 overflow-y-auto">
        {items.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              data-testid={`transaction-filter-tag-option-${t.id}`}
              className={chipOptionClass(value === t.id)}
              onClick={() => onChange(t.id)}
            >
              {t.name}
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-2 py-1 text-xs text-muted-foreground">No tags.</li>
        ) : null}
      </ul>
    </div>
  );
}

function KindEditor({
  value,
  onChange,
}: {
  value: TransactionKind | null;
  onChange: (next: TransactionKind | null) => void;
}) {
  return (
    <ul className="flex w-44 flex-col">
      <li>
        <button
          type="button"
          data-testid="transaction-filter-kind-option-expense"
          className={chipOptionClass(value === "expense")}
          onClick={() => onChange("expense")}
        >
          Expense
        </button>
      </li>
      <li>
        <button
          type="button"
          data-testid="transaction-filter-kind-option-income"
          className={chipOptionClass(value === "income")}
          onClick={() => onChange("income")}
        >
          Income
        </button>
      </li>
    </ul>
  );
}

function chipOptionClass(active: boolean): string {
  return active
    ? "block w-full rounded-sm bg-accent px-2 py-1.5 text-left text-sm"
    : "block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent";
}

function activeFilters(value: TransactionFilterState): FilterKey[] {
  const out: FilterKey[] = [];
  if (value.from || value.to) out.push("date");
  if (value.categoryId) out.push("category");
  if (value.tagId) out.push("tag");
  if (value.kind) out.push("kind");
  return out;
}

function summaryFor(
  filter: FilterKey,
  value: TransactionFilterState,
  pending: boolean | undefined,
  resolved: { categoryName: string | null; tagName: string | null },
): string {
  if (pending) return "Pick a value";
  if (filter === "date") {
    if (value.from && value.to) {
      return `${shortDate(value.from)} – ${shortDate(value.to)}`;
    }
    if (value.from) return `from ${shortDate(value.from)}`;
    if (value.to) return `until ${shortDate(value.to)}`;
    return "any";
  }
  if (filter === "kind") return value.kind ?? "any";
  if (filter === "category") return resolved.categoryName ?? "any";
  if (filter === "tag") return resolved.tagName ?? "any";
  return "";
}

function shortDate(iso: string): string {
  return format(parseISO(iso), "MMM d");
}
