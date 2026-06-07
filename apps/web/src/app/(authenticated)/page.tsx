"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
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
import { TransactionList } from "@/lib/cashflow/components/transaction-list";
import { useBaseCurrency } from "@/lib/cashflow/hooks";

export default function AuthenticatedRootPage() {
  const { data, isPending, isError } = useBaseCurrency();
  const [captureOpen, setCaptureOpen] = useState(false);

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

      <section aria-label="Recent transactions">
        <TransactionList />
      </section>
    </main>
  );
}
