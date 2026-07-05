"use client";

import { useCallback, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TransactionFilterBar,
  type TransactionFilterState,
} from "@/lib/cashflow/components/transaction-filter-bar";
import { TransactionList } from "@/lib/cashflow/components/transaction-list";
import type { TransactionFilters } from "@/lib/cashflow/hooks";
import { useBaseCurrency } from "@/lib/cashflow/hooks";
import type { TransactionKind } from "@/lib/cashflow/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFilters(params: URLSearchParams): TransactionFilterState {
  const from = params.get("from");
  const to = params.get("to");
  const tagId = params.get("tagId");
  const kindRaw = params.get("kind");
  const q = params.get("q");
  const kind: TransactionKind | null =
    kindRaw === "income" || kindRaw === "expense" ? kindRaw : null;
  return {
    from: from && ISO_DATE_RE.test(from) ? from : null,
    to: to && ISO_DATE_RE.test(to) ? to : null,
    tagId: tagId && UUID_RE.test(tagId) ? tagId : null,
    kind,
    q: q && q.length > 0 ? q : null,
  };
}

function toFilters(state: TransactionFilterState): TransactionFilters {
  return {
    from: state.from ?? undefined,
    to: state.to ?? undefined,
    tagId: state.tagId ?? undefined,
    kind: state.kind ?? undefined,
    q: state.q ?? undefined,
  };
}

function initialFilters(): TransactionFilterState {
  if (typeof window === "undefined") {
    return {
      from: null,
      to: null,
      tagId: null,
      kind: null,
      q: null,
    };
  }
  return parseFilters(new URLSearchParams(window.location.search));
}

/**
 * Mirror the filter state into the URL bar without triggering a Next.js
 * re-render. Using `router.replace` here would re-render the page tree on every
 * keystroke / day click, collapsing any open popover or submenu.
 */
function syncFiltersToUrl(state: TransactionFilterState): void {
  if (typeof window === "undefined") return;
  const url = new URLSearchParams();
  if (state.from) url.set("from", state.from);
  if (state.to) url.set("to", state.to);
  if (state.tagId) url.set("tagId", state.tagId);
  if (state.kind) url.set("kind", state.kind);
  if (state.q) url.set("q", state.q);
  const qs = url.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState(window.history.state, "", next);
}

export default function TransactionsPage() {
  const { data, isPending, isError } = useBaseCurrency();
  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    initialFilters(),
  );

  const onFiltersChange = useCallback((next: TransactionFilterState) => {
    setFilters(next);
    syncFiltersToUrl(next);
  }, []);

  if (isPending) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-80 w-full" />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <p role="alert" className="text-sm text-destructive">
          Could not load your transactions. Refresh and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Review your recent transactions. Rolled up into {data.baseCurrency}.
        </p>
      </header>

      <section
        aria-label="Recent transactions"
        className="overflow-hidden rounded-md border border-border"
      >
        <TransactionFilterBar value={filters} onChange={onFiltersChange} />
        <div className="border-t border-border">
          <TransactionList filters={toFilters(filters)} frameless />
        </div>
      </section>
    </main>
  );
}
