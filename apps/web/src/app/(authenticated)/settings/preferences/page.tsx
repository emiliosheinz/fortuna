"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { BaseCurrencyForm } from "@/lib/cashflow/components/base-currency-form";
import { useBaseCurrency } from "@/lib/cashflow/hooks";

export default function PreferencesPage() {
  const baseCurrency = useBaseCurrency();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">General preferences.</p>
      </header>

      <section
        data-testid="base-currency-section"
        className="flex flex-col gap-3 rounded-md border border-border p-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Base currency
        </h2>
        <p className="text-sm text-muted-foreground">
          The currency every transaction is rolled up into on read.
        </p>
        {baseCurrency.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : baseCurrency.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load your base currency. Refresh and try again.
          </p>
        ) : (
          <BaseCurrencyForm initial={baseCurrency.data.baseCurrency} />
        )}
      </section>
    </main>
  );
}
