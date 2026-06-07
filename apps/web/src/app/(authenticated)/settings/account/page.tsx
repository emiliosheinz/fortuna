"use client";

import { useAuth } from "@/components/auth/auth-guard";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/lib/auth/components/sign-out-button";
import { BaseCurrencyForm } from "@/lib/cashflow/components/base-currency-form";
import { useBaseCurrency } from "@/lib/cashflow/hooks";
import { SessionsSection } from "@/lib/sessions/components/sessions-section";

export default function AccountSettingsPage() {
  const { me } = useAuth();
  const baseCurrency = useBaseCurrency();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Account</h1>
        <SignOutButton />
      </header>

      <section className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Profile
        </h2>
        <p className="text-base">{me.name}</p>
        <p className="text-sm text-muted-foreground">{me.email}</p>
      </section>

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

      <SessionsSection />

      <section
        data-testid="danger-zone"
        className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">
          Danger zone
        </h2>
        <p className="text-sm">
          Deleting your account permanently erases your profile, sessions, and
          identity link with Google. Sign-in events are anonymized but retained
          for security forensics. This action cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
