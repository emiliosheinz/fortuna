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
import { SUPPORTED_CURRENCIES, TRANSACTION_KINDS } from "../constants";
import { useCreateTransaction } from "../hooks";
import { generateInstallmentDates } from "../installment-dates";
import type { CreateTransactionInput, TransactionKind } from "../types";
import { CategoryCombobox } from "./category-combobox";
import { MoneyInput } from "./money-input";
import { TagInput } from "./tag-input";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const INSTALLMENTS_MIN = 2;
const INSTALLMENTS_MAX = 360;

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
  installmentsOn: boolean;
  installmentsCount: number;
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
  const installmentsToggleId = useId();
  const installmentsCountId = useId();
  const [form, setForm] = useState<FormState>(() => ({
    description: "",
    amount: "",
    date: todayIso(),
    kind: "expense",
    currency: baseCurrency,
    categoryId: null,
    tagNames: [],
    installmentsOn: false,
    installmentsCount: 2,
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
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(form.currency)) {
      next.currency = "Pick a supported currency.";
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
    if (form.installmentsOn && form.installmentsCount >= INSTALLMENTS_MIN) {
      payload.installments = { count: form.installmentsCount };
    }

    try {
      await mutation.mutateAsync(payload);
      setForm((prev) => ({
        ...prev,
        description: "",
        amount: "",
        categoryId: null,
        tagNames: [],
        installmentsOn: false,
        installmentsCount: 2,
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
        <Select
          value={form.currency}
          onValueChange={(value) => update("currency", value)}
        >
          <SelectTrigger
            id={currencyId}
            data-testid="capture-form-currency-trigger"
            className="w-full"
            aria-invalid={Boolean(errors.currency)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.currency ? <FieldError message={errors.currency} /> : null}
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

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex items-center gap-2">
          <input
            id={installmentsToggleId}
            type="checkbox"
            checked={form.installmentsOn}
            onChange={(e) => update("installmentsOn", e.target.checked)}
            className="size-4 rounded border-border text-foreground focus-visible:ring-ring/50"
          />
          <Label htmlFor={installmentsToggleId} className="cursor-pointer">
            Split into installments
          </Label>
        </div>
        {form.installmentsOn ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={installmentsCountId}>
                Number of installments
              </Label>
              <Input
                id={installmentsCountId}
                type="number"
                min={INSTALLMENTS_MIN}
                max={INSTALLMENTS_MAX}
                inputMode="numeric"
                value={form.installmentsCount}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  if (Number.isInteger(next) && next > 0) {
                    update(
                      "installmentsCount",
                      Math.min(INSTALLMENTS_MAX, Math.max(1, next)),
                    );
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                One row per month, end-of-month dates clamp to the last day.
              </p>
            </div>
            <InstallmentPreview
              startDate={form.date}
              count={form.installmentsCount}
            />
          </>
        ) : null}
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

function InstallmentPreview({
  startDate,
  count,
}: {
  startDate: string;
  count: number;
}) {
  const dates = generateInstallmentDates(startDate, count);
  if (dates.length === 0) return null;
  return (
    <ul
      data-testid="capture-form-installment-preview"
      className="flex flex-wrap gap-1 text-xs text-muted-foreground"
    >
      {dates.map((d, i) => (
        <li key={d} className="rounded-full bg-accent px-2 py-0.5">
          {i + 1}. {format(parseISO(d), "MMM d, yyyy")}
        </li>
      ))}
    </ul>
  );
}
