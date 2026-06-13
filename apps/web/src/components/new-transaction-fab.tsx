"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CaptureForm } from "@/lib/cashflow/components/capture-form";
import { useBaseCurrency } from "@/lib/cashflow/hooks";

const TOOLTIP_LABEL = "New transaction";

export function NewTransactionFab() {
  const [open, setOpen] = useState(false);
  const baseCurrency = useBaseCurrency();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="group fixed right-6 bottom-6 z-40 sm:right-8 sm:bottom-8">
        <Button
          type="button"
          data-testid="open-capture-dialog"
          aria-label={TOOLTIP_LABEL}
          title={TOOLTIP_LABEL}
          onClick={() => setOpen(true)}
          className="size-12 rounded-full shadow-lg"
        >
          <PlusIcon className="size-5" aria-hidden />
        </Button>
        <span
          role="tooltip"
          data-testid="fab-tooltip"
          className="pointer-events-none absolute top-1/2 right-full mr-3 -translate-y-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {TOOLTIP_LABEL}
        </span>
      </div>
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
