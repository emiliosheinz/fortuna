"use client";

import { format, parseISO } from "date-fns";
import {
  CalendarRangeIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HashIcon,
  ListFilterIcon,
  SearchIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCategories, useTags } from "../hooks";
import type { TransactionKind } from "../types";

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
  searchDebounceMs?: number;
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

const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

export function TransactionFilterBar({
  value,
  onChange,
  searchDebounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
}: TransactionFilterBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = activeFilters(value);
  const allFilters = Object.keys(FILTER_LABELS) as FilterKey[];

  function reset(key: FilterKey) {
    const next = { ...value };
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
    onChange(next);
  }

  return (
    <div
      data-testid="transaction-filter-bar"
      className="flex flex-col gap-2 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <AddFilterPopover
          open={menuOpen}
          onOpenChange={setMenuOpen}
          filters={allFilters}
          value={value}
          onChange={onChange}
        />

        <SearchInput
          value={value.q}
          onCommit={(next) => onChange({ ...value, q: next })}
          debounceMs={searchDebounceMs}
        />

        {active.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
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

      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((key) => (
            <FilterChip
              key={key}
              filter={key}
              value={value}
              onChange={onChange}
              onRemove={() => reset(key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AddFilterPopover({
  open,
  onOpenChange,
  filters,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  filters: FilterKey[];
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
}) {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<FilterKey>(filters[0] ?? "date");
  const [mobileView, setMobileView] = useState<"menu" | "editor">("menu");

  useEffect(() => {
    if (!open) {
      setHovered(filters[0] ?? "date");
      setMobileView("menu");
    }
  }, [open, filters]);

  useEffect(() => {
    if (!isMobile) setMobileView("menu");
  }, [isMobile]);

  function selectFilter(key: FilterKey) {
    setHovered(key);
    if (isMobile) setMobileView("editor");
  }

  const showMenu = !isMobile || mobileView === "menu";
  const showEditor = !isMobile || mobileView === "editor";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid="transaction-filter-add"
        >
          <ListFilterIcon className="size-4" />
          Add filter
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        {showMenu ? (
          <ul
            className={
              isMobile
                ? "flex w-64 flex-col py-1"
                : "flex w-48 flex-col border-r border-border py-1"
            }
          >
            {filters.map((key) => {
              const Icon = FILTER_ICONS[key];
              const highlighted = !isMobile && hovered === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    data-testid={`transaction-filter-add-${key}`}
                    onMouseEnter={isMobile ? undefined : () => setHovered(key)}
                    onFocus={isMobile ? undefined : () => setHovered(key)}
                    onClick={() => selectFilter(key)}
                    className={
                      highlighted
                        ? "flex w-full items-center gap-2 bg-accent px-3 py-1.5 text-left text-sm"
                        : "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent/50"
                    }
                  >
                    <Icon className="size-4 opacity-70" />
                    <span className="flex-1">{FILTER_LABELS[key]}</span>
                    <ChevronRightIcon className="size-4 opacity-40" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {showEditor ? (
          <div
            className={
              isMobile ? "flex w-full flex-col p-2" : "min-w-[18rem] p-2"
            }
          >
            {isMobile ? (
              <button
                type="button"
                aria-label="Back to filters"
                onClick={() => setMobileView("menu")}
                className="mb-2 flex items-center gap-1 self-start rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              >
                <ChevronLeftIcon className="size-4" />
                {FILTER_LABELS[hovered]}
              </button>
            ) : null}
            <FilterEditor
              filter={hovered}
              value={value}
              onChange={onChange}
              onApplied={() => onOpenChange(false)}
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function SearchInput({
  value,
  onCommit,
  debounceMs,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
  debounceMs: number;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const lastCommitted = useRef(value ?? "");

  useEffect(() => {
    if ((value ?? "") !== lastCommitted.current) {
      setDraft(value ?? "");
      lastCommitted.current = value ?? "";
    }
  }, [value]);

  useEffect(() => {
    if (draft === lastCommitted.current) return;
    const handle = setTimeout(() => {
      lastCommitted.current = draft;
      onCommit(draft.length === 0 ? null : draft);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [draft, debounceMs, onCommit]);

  return (
    <div className="relative min-w-48 flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        data-testid="transaction-filter-q"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search description"
        className="pl-9"
      />
    </div>
  );
}

interface FilterChipProps {
  filter: FilterKey;
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
  onRemove: () => void;
}

function FilterChip({ filter, value, onChange, onRemove }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const Icon = FILTER_ICONS[filter];
  const categories = useCategories();
  const tags = useTags();

  const summary = summaryFor(filter, value, {
    categoryName:
      categories.data?.items.find((c) => c.id === value.categoryId)?.name ??
      null,
    tagName: tags.data?.items.find((t) => t.id === value.tagId)?.name ?? null,
  });

  return (
    <div
      data-testid={`transaction-filter-chip-${filter}`}
      className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background pl-2.5 pr-1 text-xs"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={`transaction-filter-chip-${filter}-trigger`}
            className="flex items-center gap-1.5 rounded-sm px-1 hover:bg-accent/40"
          >
            <span className="font-medium">{FILTER_LABELS[filter]}</span>
            <span className="text-muted-foreground">{summary}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-w-[calc(100vw-2rem)] p-2"
          align="start"
        >
          <FilterEditor
            filter={filter}
            value={value}
            onChange={onChange}
            onApplied={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={`Remove ${FILTER_LABELS[filter]} filter`}
        data-testid={`transaction-filter-chip-${filter}-remove`}
        onClick={onRemove}
        className="ml-0.5 flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </div>
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
  onApplied?: () => void;
}) {
  if (filter === "date") {
    return (
      <DateRangeCalendar
        from={value.from}
        to={value.to}
        onChange={(next) => {
          onChange({ ...value, from: next.from, to: next.to });
        }}
        onComplete={() => onApplied?.()}
      />
    );
  }
  if (filter === "category") {
    return (
      <CategoryEditor
        value={value.categoryId}
        onChange={(next) => {
          onChange({ ...value, categoryId: next });
          if (next) onApplied?.();
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
          if (next) onApplied?.();
        }}
      />
    );
  }
  return (
    <KindEditor
      value={value.kind}
      onChange={(next) => {
        onChange({ ...value, kind: next });
        if (next) onApplied?.();
      }}
    />
  );
}

function DateRangeCalendar({
  from,
  to,
  onChange,
  onComplete,
}: {
  from: string | null;
  to: string | null;
  onChange: (next: { from: string | null; to: string | null }) => void;
  onComplete?: () => void;
}) {
  const clickCount = useRef(0);

  useEffect(() => {
    if (!from && !to) clickCount.current = 0;
  }, [from, to]);

  // While the range is in progress (from set, to unset), hide `to` from
  // react-day-picker so it only fires `range_start` on the start day — the
  // visual stays a half-rounded marker instead of a fully rounded selection.
  const selected: DateRange | undefined = from
    ? to
      ? { from: parseISO(from), to: parseISO(to) }
      : { from: parseISO(from) }
    : undefined;

  return (
    <div data-testid="transaction-filter-date-editor">
      <Calendar
        mode="range"
        numberOfMonths={1}
        selected={selected}
        classNames={DATE_RANGE_CALENDAR_CLASSNAMES}
        onSelect={(next) => {
          if (!next?.from) {
            clickCount.current = 0;
            onChange({ from: null, to: null });
            return;
          }
          clickCount.current += 1;
          const fromIso = format(next.from, "yyyy-MM-dd");
          if (clickCount.current === 1) {
            onChange({ from: fromIso, to: null });
            return;
          }
          const endDate = next.to ?? next.from;
          const endIso = format(endDate, "yyyy-MM-dd");
          const [orderedFrom, orderedTo] =
            fromIso <= endIso ? [fromIso, endIso] : [endIso, fromIso];
          clickCount.current = 0;
          onChange({ from: orderedFrom, to: orderedTo });
          onComplete?.();
        }}
        autoFocus
      />
    </div>
  );
}

// Keep shadcn's defaults for `day` and `day_button` (so a single selected day
// renders as a fully rounded primary marker). Only override the range
// modifiers to flatten the inner corners and shade the middle days, so a
// completed range connects edge-to-edge instead of rendering as three pills.
const DATE_RANGE_CALENDAR_CLASSNAMES = {
  range_start: "[&>button]:rounded-r-none",
  range_middle:
    "[&>button]:!bg-accent [&>button]:!text-accent-foreground [&>button]:rounded-none",
  range_end: "[&>button]:rounded-l-none",
};

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
  resolved: { categoryName: string | null; tagName: string | null },
): string {
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
