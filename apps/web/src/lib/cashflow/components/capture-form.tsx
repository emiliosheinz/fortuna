"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
import { useResponsiveDialogScrollIntoView } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES, TRANSACTION_KINDS } from "../constants";
import { useCreateTransaction } from "../hooks";
import type { CreateTransactionInput, TransactionKind } from "../types";
import { CurrencyOption } from "./currency-option";
import { MoneyInput } from "./money-input";
import { TagInput } from "./tag-input";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
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
  const [form, setForm] = useState<FormState>(() => ({
    description: "",
    amount: "",
    date: todayIso(),
    kind: "expense",
    currency: baseCurrency,
    categoryId: null,
    tagNames: [],
    installmentsCount: 1,
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const submitErrorRef = useRef<HTMLParagraphElement | null>(null);
  const scrollIntoView = useResponsiveDialogScrollIntoView();
  const mutation = useCreateTransaction();

  function showSubmitError(message: string) {
    flushSync(() => setSubmitError(message));
    scrollIntoView(submitErrorRef.current);
  }

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
    if (form.installmentsCount > 1) {
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
        installmentsCount: 1,
      }));
      onCaptured?.();
    } catch (err) {
      showSubmitError(
        err instanceof ApiError && err.status === 400
          ? "The server rejected the payload. Check the fields."
          : "Could not save the transaction. Try again.",
      );
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
        <Label>Amount</Label>
        <div className="grid grid-cols-[6rem_1fr_5rem] gap-2 sm:grid-cols-[7rem_1fr_7rem]">
          <KeyboardSafeSelect
            value={form.currency}
            onValueChange={(value) => update("currency", value)}
          >
            <KeyboardSafeSelectTrigger
              id={currencyId}
              data-testid="capture-form-currency-trigger"
              aria-label="Currency"
              aria-invalid={Boolean(errors.currency)}
              className="w-full"
            >
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
          <MoneyInput
            id={amountId}
            value={form.amount}
            aria-label="Amount"
            aria-invalid={Boolean(errors.amount)}
            onChange={(next) => update("amount", next)}
          />
          <InstallmentsStepper
            count={form.installmentsCount}
            onChange={(next) => update("installmentsCount", next)}
          />
        </div>
        <InstallmentsSummary
          count={form.installmentsCount}
          amount={form.amount}
          currency={form.currency}
        />
        {errors.currency ? <FieldError message={errors.currency} /> : null}
        {errors.amount ? <FieldError message={errors.amount} /> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={dateId}>Date</Label>
        <KeyboardSafePopover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <KeyboardSafePopoverTrigger asChild>
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
          </KeyboardSafePopoverTrigger>
          <KeyboardSafePopoverContent className="w-auto p-0" align="start">
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
          </KeyboardSafePopoverContent>
        </KeyboardSafePopover>
        {errors.date ? <FieldError message={errors.date} /> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={kindId}>Kind</Label>
        <KeyboardSafeSelect
          value={form.kind}
          onValueChange={(value) => update("kind", value as TransactionKind)}
        >
          <KeyboardSafeSelectTrigger
            id={kindId}
            data-testid="capture-form-kind-trigger"
            className="w-full"
          >
            <KeyboardSafeSelectValue />
          </KeyboardSafeSelectTrigger>
          <KeyboardSafeSelectContent>
            {TRANSACTION_KINDS.map((kind) => (
              <KeyboardSafeSelectItem key={kind} value={kind}>
                {kind === "expense" ? "Expense" : "Income"}
              </KeyboardSafeSelectItem>
            ))}
          </KeyboardSafeSelectContent>
        </KeyboardSafeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={categoryId}>Category</Label>
        <KeyboardSafeCombobox
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
          ref={submitErrorRef}
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

function InstallmentsStepper({
  count,
  onChange,
}: {
  count: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(count));
  useEffect(() => {
    setDraft(String(count));
  }, [count]);

  const decDisabled = count <= 1;
  const incDisabled = count >= INSTALLMENTS_MAX;

  function clamp(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.min(INSTALLMENTS_MAX, Math.max(1, Math.trunc(value)));
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
    setDraft(digits);
    if (digits === "") return;
    const next = clamp(Number.parseInt(digits, 10));
    if (next !== count) onChange(next);
  }

  function handleBlur() {
    const next = draft === "" ? 1 : clamp(Number.parseInt(draft, 10));
    setDraft(String(next));
    if (next !== count) onChange(next);
  }

  return (
    <div
      data-testid="capture-form-installments-stepper"
      className="flex h-9 w-full items-center rounded-md border border-input bg-transparent text-sm shadow-xs dark:bg-input/30"
    >
      <button
        type="button"
        data-testid="capture-form-installments-dec"
        aria-label="Decrease installments"
        disabled={decDisabled}
        onClick={() => onChange(Math.max(1, count - 1))}
        className="flex h-full flex-1 items-center justify-center rounded-l-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <MinusIcon className="size-3.5" />
      </button>
      <input
        data-testid="capture-form-installments-count"
        aria-label="Number of installments"
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(event) => event.currentTarget.select()}
        className="h-full w-8 bg-transparent text-center text-sm tabular-nums outline-none sm:w-10"
      />
      <button
        type="button"
        data-testid="capture-form-installments-inc"
        aria-label="Increase installments"
        disabled={incDisabled}
        onClick={() => onChange(Math.min(INSTALLMENTS_MAX, count + 1))}
        className="flex h-full flex-1 items-center justify-center rounded-r-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  );
}

function InstallmentsSummary({
  count,
  amount,
  currency,
}: {
  count: number;
  amount: string;
  currency: string;
}) {
  const per = AMOUNT_RE.test(amount) ? amount : "0.00";
  const total = (Number(per) * count).toFixed(2);
  return (
    <p
      data-testid="capture-form-installments-summary"
      className="text-xs text-muted-foreground"
    >
      {count} x {per} {currency} = {total} {currency}
    </p>
  );
}
