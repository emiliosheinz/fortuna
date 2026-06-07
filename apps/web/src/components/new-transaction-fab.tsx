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
import { useBaseCurrency } from "@/lib/cashflow/hooks";

export function NewTransactionFab() {
  const [open, setOpen] = useState(false);
  const baseCurrency = useBaseCurrency();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          data-testid="open-capture-dialog"
          aria-label="New transaction"
          className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg sm:right-8 sm:bottom-8"
        >
          <PlusIcon className="size-6" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
        </DialogHeader>
        {renderFormBody(baseCurrency, () => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

function renderFormBody(
  baseCurrency: ReturnType<typeof useBaseCurrency>,
  onCaptured: () => void,
): React.ReactNode {
  if (baseCurrency.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (baseCurrency.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your base currency. Refresh and try again.
      </p>
    );
  }
  return (
    <CaptureForm
      baseCurrency={baseCurrency.data.baseCurrency}
      onCaptured={onCaptured}
    />
  );
}
