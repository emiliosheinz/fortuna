"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CaptureForm } from "@/lib/cashflow/components/capture-form";
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
  const categoryId = params.get("categoryId");
  const tagId = params.get("tagId");
  const kindRaw = params.get("kind");
  const q = params.get("q");
  const kind: TransactionKind | null =
    kindRaw === "income" || kindRaw === "expense" ? kindRaw : null;
  return {
    from: from && ISO_DATE_RE.test(from) ? from : null,
    to: to && ISO_DATE_RE.test(to) ? to : null,
    categoryId: categoryId && UUID_RE.test(categoryId) ? categoryId : null,
    tagId: tagId && UUID_RE.test(tagId) ? tagId : null,
    kind,
    q: q && q.length > 0 ? q : null,
  };
}

function toFilters(state: TransactionFilterState): TransactionFilters {
  return {
    from: state.from ?? undefined,
    to: state.to ?? undefined,
    categoryId: state.categoryId ?? undefined,
    tagId: state.tagId ?? undefined,
    kind: state.kind ?? undefined,
    q: state.q ?? undefined,
  };
}

export default function AuthenticatedRootPage() {
  const { data, isPending, isError } = useBaseCurrency();
  const [captureOpen, setCaptureOpen] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const filters = parseFilters(params);

  const onFiltersChange = useCallback(
    (next: TransactionFilterState) => {
      const url = new URLSearchParams();
      if (next.from) url.set("from", next.from);
      if (next.to) url.set("to", next.to);
      if (next.categoryId) url.set("categoryId", next.categoryId);
      if (next.tagId) url.set("tagId", next.tagId);
      if (next.kind) url.set("kind", next.kind);
      if (next.q) url.set("q", next.q);
      const qs = url.toString();
      router.replace(qs ? `/?${qs}` : "/");
    },
    [router],
  );

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
          Could not load your cashflow. Refresh and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Cashflow</h1>
          <p className="text-sm text-muted-foreground">
            Review your recent transactions. Rolled up into {data.baseCurrency}.
          </p>
        </div>
        <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
          <DialogTrigger asChild>
            <Button type="button" data-testid="open-capture-dialog">
              <PlusIcon className="size-4" />
              New transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New transaction</DialogTitle>
            </DialogHeader>
            <CaptureForm
              baseCurrency={data.baseCurrency}
              onCaptured={() => setCaptureOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </header>

      <nav
        aria-label="Cashflow views"
        className="flex flex-wrap gap-2 text-sm"
        data-testid="cashflow-nav"
      >
        <Link
          href="/summary"
          className="rounded-md border border-border px-3 py-1.5 transition hover:bg-accent/40"
        >
          Monthly summary
        </Link>
        <Link
          href="/trend"
          className="rounded-md border border-border px-3 py-1.5 transition hover:bg-accent/40"
        >
          Cash-flow trend
        </Link>
      </nav>

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
