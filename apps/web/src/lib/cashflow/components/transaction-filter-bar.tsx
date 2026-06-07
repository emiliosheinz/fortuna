"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRANSACTION_KINDS } from "../constants";
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

const ALL = "__all__";

export function TransactionFilterBar({
  value,
  onChange,
}: TransactionFilterBarProps) {
  const rangeId = useId();
  const catId = useId();
  const tagId = useId();
  const kindId = useId();
  const qId = useId();
  const categories = useCategories();
  const tags = useTags();

  function update<K extends keyof TransactionFilterState>(
    key: K,
    next: TransactionFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  const hasAny =
    value.from !== null ||
    value.to !== null ||
    value.categoryId !== null ||
    value.tagId !== null ||
    value.kind !== null ||
    (value.q !== null && value.q.length > 0);

  return (
    <div
      data-testid="transaction-filter-bar"
      className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={rangeId}>Date range</Label>
        <DateRangePicker
          id={rangeId}
          value={{ from: value.from, to: value.to }}
          data-testid="transaction-filter-range"
          onChange={(next) =>
            onChange({ ...value, from: next.from, to: next.to })
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={catId}>Category</Label>
        <Select
          value={value.categoryId ?? ALL}
          onValueChange={(v) => update("categoryId", v === ALL ? null : v)}
        >
          <SelectTrigger
            id={catId}
            data-testid="transaction-filter-category"
            className="w-full"
          >
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {(categories.data?.items ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={tagId}>Tag</Label>
        <Select
          value={value.tagId ?? ALL}
          onValueChange={(v) => update("tagId", v === ALL ? null : v)}
        >
          <SelectTrigger
            id={tagId}
            data-testid="transaction-filter-tag"
            className="w-full"
          >
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tags</SelectItem>
            {(tags.data?.items ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={kindId}>Kind</Label>
        <Select
          value={value.kind ?? ALL}
          onValueChange={(v) =>
            update("kind", v === ALL ? null : (v as TransactionKind))
          }
        >
          <SelectTrigger
            id={kindId}
            data-testid="transaction-filter-kind"
            className="w-full"
          >
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any</SelectItem>
            {TRANSACTION_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k === "expense" ? "Expense" : "Income"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={qId}>Search description</Label>
        <Input
          id={qId}
          type="search"
          data-testid="transaction-filter-q"
          value={value.q ?? ""}
          onChange={(e) => update("q", e.target.value || null)}
          placeholder="e.g. coffee"
        />
      </div>
      {hasAny ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <Button
            type="button"
            variant="outline"
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
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
