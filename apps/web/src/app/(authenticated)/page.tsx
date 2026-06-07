"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { CaptureForm } from "@/lib/cashflow/components/capture-form";
import { TransactionList } from "@/lib/cashflow/components/transaction-list";
import { useBaseCurrency } from "@/lib/cashflow/hooks";

export default function AuthenticatedRootPage() {
  const { data, isPending, isError } = useBaseCurrency();

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
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Cashflow</h1>
        <p className="text-sm text-muted-foreground">
          Capture transactions and review the recent list. Rolled up into{" "}
          {data.baseCurrency}.
        </p>
      </header>

      <section
        aria-labelledby="capture-heading"
        className="rounded-md border border-border p-4"
      >
        <h2 id="capture-heading" className="mb-3 text-sm font-semibold">
          Capture
        </h2>
        <CaptureForm baseCurrency={data.baseCurrency} />
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <h2 id="recent-heading" className="text-sm font-semibold">
          Recent transactions
        </h2>
        <TransactionList />
      </section>
    </main>
  );
}
