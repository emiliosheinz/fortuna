"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { isFrankfurterSupported, TRANSACTION_KINDS } from "../constants";
import { useCreateTransaction } from "../hooks";
import type { CreateTransactionInput, TransactionKind } from "../types";
import { CategoryCombobox } from "./category-combobox";
import { CurrencyInput } from "./currency-input";
import { MoneyInput } from "./money-input";
import { TagInput } from "./tag-input";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

interface CaptureFormProps {
  baseCurrency: string;
  onCaptured?: () => void;
}

interface FormState {
  description: string;
  amount: string;
  date: string;
  kind: TransactionKind;
  currency: string;
  categoryId: string | null;
  tagNames: string[];
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function CaptureForm({ baseCurrency, onCaptured }: CaptureFormProps) {
  const descriptionId = useId();
  const amountId = useId();
  const dateId = useId();
  const kindId = useId();
  const currencyId = useId();
  const categoryId = useId();
  const tagsId = useId();
  const [form, setForm] = useState<FormState>(() => ({
    description: "",
    amount: "",
    date: todayIso(),
    kind: "expense",
    currency: baseCurrency,
    categoryId: null,
    tagNames: [],
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const mutation = useCreateTransaction();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): Partial<Record<keyof FormState, string>> {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.description.trim()) next.description = "Add a description.";
    if (!AMOUNT_RE.test(form.amount)) {
      next.amount = "Use a non-negative amount with up to two decimals.";
    }
    if (!form.date) next.date = "Pick a date.";
    if (!/^[A-Z]{3}$/.test(form.currency)) {
      next.currency = "Pick a 3-letter ISO 4217 code.";
    }
    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const v = validate();
    setErrors(v);
    if (Object.values(v).some(Boolean)) return;

    const payload: CreateTransactionInput = {
      date: form.date,
      amount: form.amount,
      currency: form.currency,
      description: form.description.trim(),
      kind: form.kind,
      categoryId: form.categoryId,
      tagNames: form.tagNames,
    };

    try {
      await mutation.mutateAsync(payload);
      setForm((prev) => ({
        ...prev,
        description: "",
        amount: "",
        categoryId: null,
        tagNames: [],
      }));
      onCaptured?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setSubmitError("The server rejected the payload. Check the fields.");
      } else {
        setSubmitError("Could not save the transaction. Try again.");
      }
    }
  }

  return (
    <form
      noValidate
      data-testid="capture-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={descriptionId}>Description</Label>
        <Input
          id={descriptionId}
          value={form.description}
          aria-invalid={Boolean(errors.description)}
          onChange={(e) => update("description", e.target.value)}
        />
        {errors.description ? (
          <FieldError message={errors.description} />
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={amountId}>Amount</Label>
        <MoneyInput
          id={amountId}
          value={form.amount}
          aria-invalid={Boolean(errors.amount)}
          onChange={(next) => update("amount", next)}
        />
        {errors.amount ? <FieldError message={errors.amount} /> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={dateId}>Date</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              id={dateId}
              type="button"
              variant="outline"
              data-testid="capture-form-date-trigger"
              className={cn(
                "justify-start text-left font-normal",
                !form.date && "text-muted-foreground",
              )}
              aria-invalid={Boolean(errors.date)}
            >
              <CalendarIcon className="size-4" />
              {form.date ? format(parseISO(form.date), "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={form.date ? parseISO(form.date) : undefined}
              onSelect={(picked) => {
                if (picked) {
                  update("date", format(picked, "yyyy-MM-dd"));
                  setCalendarOpen(false);
                }
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date ? <FieldError message={errors.date} /> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={kindId}>Kind</Label>
        <Select
          value={form.kind}
          onValueChange={(value) => update("kind", value as TransactionKind)}
        >
          <SelectTrigger
            id={kindId}
            data-testid="capture-form-kind-trigger"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind === "expense" ? "Expense" : "Income"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={currencyId}>Currency</Label>
        <CurrencyInput
          id={currencyId}
          value={form.currency}
          onChange={(next) => update("currency", next)}
          aria-invalid={Boolean(errors.currency)}
        />
        {errors.currency ? <FieldError message={errors.currency} /> : null}
        {!errors.currency &&
        form.currency.length === 3 &&
        !isFrankfurterSupported(form.currency) ? (
          <p
            data-testid="capture-form-currency-unconvertible"
            className="text-sm text-muted-foreground"
          >
            {form.currency} isn't covered by the FX provider — this row will
            still record but its base-currency rollup will be unconvertible.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={categoryId}>Category</Label>
        <CategoryCombobox
          id={categoryId}
          value={form.categoryId}
          onChange={(next) => update("categoryId", next)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={tagsId}>Tags</Label>
        <TagInput
          id={tagsId}
          value={form.tagNames}
          onChange={(next) => update("tagNames", next)}
        />
      </div>

      {submitError ? (
        <p
          data-testid="capture-form-submit-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {submitError}
        </p>
      ) : null}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save transaction"}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-destructive">{message}</p>;
}
