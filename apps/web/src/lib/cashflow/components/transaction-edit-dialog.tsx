"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { KeyboardSafeCombobox } from "@/components/keyboard-safe-combobox";
import {
  KeyboardSafePopover,
  KeyboardSafePopoverContent,
  KeyboardSafePopoverTrigger,
} from "@/components/keyboard-safe-popover";
import {
  KeyboardSafeSelect,
  KeyboardSafeSelectContent,
  KeyboardSafeSelectItem,
  KeyboardSafeSelectTrigger,
  KeyboardSafeSelectValue,
} from "@/components/keyboard-safe-select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  useResponsiveDialogScrollIntoView,
} from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES, TRANSACTION_KINDS } from "../constants";
import { useDeleteTransaction, useTags, useUpdateTransaction } from "../hooks";
import type {
  Transaction,
  TransactionKind,
  UpdateTransactionInput,
} from "../types";
import { CurrencyOption } from "./currency-option";
import { MoneyInput } from "./money-input";
import { TagInput } from "./tag-input";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

interface TransactionEditDialogProps {
  transaction: Transaction;
  onClose: () => void;
}

export function TransactionEditDialog({
  transaction,
  onClose,
}: TransactionEditDialogProps) {
  const descriptionId = useId();
  const amountId = useId();
  const dateId = useId();
  const kindId = useId();
  const currencyId = useId();
  const categoryId = useId();
  const tagsId = useId();
  const tags = useTags();
  const initialTagNames = tags.data
    ? transaction.tagIds
        .map((id) => tags.data.items.find((t) => t.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    : [];

  const [date, setDate] = useState(transaction.date);
  const [amount, setAmount] = useState(transaction.amount);
  const [currency, setCurrency] = useState(transaction.currency);
  const [description, setDescription] = useState(transaction.description);
  const [kind, setKind] = useState<TransactionKind>(transaction.kind);
  const [categoryIdValue, setCategoryIdValue] = useState<string | null>(
    transaction.categoryId,
  );
  const [tagNames, setTagNames] = useState<string[]>(initialTagNames);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const scrollIntoView = useResponsiveDialogScrollIntoView();

  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  function showError(message: string) {
    flushSync(() => setError(message));
    scrollIntoView(errorRef.current);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!AMOUNT_RE.test(amount)) {
      showError("Use a non-negative amount with up to two decimals.");
      return;
    }
    if (!description.trim()) {
      showError("Add a description.");
      return;
    }

    const payload: UpdateTransactionInput = {
      date,
      amount,
      currency,
      description: description.trim(),
      kind,
      categoryId: categoryIdValue,
      tagNames,
    };

    try {
      await update.mutateAsync({ id: transaction.id, input: payload });
      onClose();
    } catch (err) {
      showError(
        err instanceof ApiError && err.status === 400
          ? "The server rejected the payload. Check the fields."
          : "Could not save changes. Try again.",
      );
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await remove.mutateAsync(transaction.id);
      onClose();
    } catch {
      showError("Could not delete transaction. Try again.");
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit transaction</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          onSubmit={handleSave}
          data-testid="transaction-edit-form"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={descriptionId}>Description</Label>
            <Input
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={amountId}>Amount</Label>
            <MoneyInput id={amountId} value={amount} onChange={setAmount} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={dateId}>Date</Label>
            <KeyboardSafePopover
              open={calendarOpen}
              onOpenChange={setCalendarOpen}
            >
              <KeyboardSafePopoverTrigger asChild>
                <Button
                  id={dateId}
                  type="button"
                  variant="outline"
                  data-testid="transaction-edit-date-trigger"
                  className={cn(
                    "justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="size-4" />
                  {date ? format(parseISO(date), "PPP") : "Pick a date"}
                </Button>
              </KeyboardSafePopoverTrigger>
              <KeyboardSafePopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date ? parseISO(date) : undefined}
                  onSelect={(picked) => {
                    if (picked) {
                      setDate(format(picked, "yyyy-MM-dd"));
                      setCalendarOpen(false);
                    }
                  }}
                  autoFocus
                />
              </KeyboardSafePopoverContent>
            </KeyboardSafePopover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={kindId}>Kind</Label>
            <KeyboardSafeSelect
              value={kind}
              onValueChange={(value) => setKind(value as TransactionKind)}
            >
              <KeyboardSafeSelectTrigger id={kindId} className="w-full">
                <KeyboardSafeSelectValue />
              </KeyboardSafeSelectTrigger>
              <KeyboardSafeSelectContent>
                {TRANSACTION_KINDS.map((k) => (
                  <KeyboardSafeSelectItem key={k} value={k}>
                    {k === "expense" ? "Expense" : "Income"}
                  </KeyboardSafeSelectItem>
                ))}
              </KeyboardSafeSelectContent>
            </KeyboardSafeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={currencyId}>Currency</Label>
            <KeyboardSafeSelect value={currency} onValueChange={setCurrency}>
              <KeyboardSafeSelectTrigger id={currencyId} className="w-full">
                <KeyboardSafeSelectValue />
              </KeyboardSafeSelectTrigger>
              <KeyboardSafeSelectContent>
                {SUPPORTED_CURRENCIES.map((code) => (
                  <KeyboardSafeSelectItem key={code} value={code}>
                    <CurrencyOption code={code} />
                  </KeyboardSafeSelectItem>
                ))}
              </KeyboardSafeSelectContent>
            </KeyboardSafeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={categoryId}>Category</Label>
            <KeyboardSafeCombobox
              id={categoryId}
              value={categoryIdValue}
              onChange={setCategoryIdValue}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={tagsId}>Tags</Label>
            <TagInput id={tagsId} value={tagNames} onChange={setTagNames} />
          </div>

          {error ? (
            <p
              ref={errorRef}
              role="alert"
              data-testid="transaction-edit-error"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmingDelete(true)}
              data-testid="transaction-edit-delete"
            >
              Delete
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {confirmingDelete ? (
          <ResponsiveDialog
            open
            onOpenChange={(open) =>
              !open ? setConfirmingDelete(false) : undefined
            }
          >
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>
                  Delete transaction?
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  This permanently removes the row. It cannot be undone.
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={handleDelete}
                  data-testid="transaction-edit-delete-confirm"
                >
                  {remove.isPending ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
