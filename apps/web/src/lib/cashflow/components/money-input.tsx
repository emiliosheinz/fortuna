"use client";

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Canonical amount string ("X.XX" or ""). */
  value: string;
  onChange: (next: string) => void;
}

const formatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function canonicalToCents(value: string): number {
  if (!value) return 0;
  const [whole = "0", decimal = "0"] = value.split(".");
  const wholeCents = Number.parseInt(whole, 10) * 100;
  const decimalCents = Number.parseInt(decimal.padEnd(2, "0").slice(0, 2), 10);
  if (!Number.isFinite(wholeCents) || !Number.isFinite(decimalCents)) return 0;
  return wholeCents + decimalCents;
}

export function centsToCanonical(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

function formatDisplay(cents: number): string {
  if (!cents) return "";
  return formatter.format(cents / 100);
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput({ value, onChange, placeholder, ...props }, ref) {
    const cents = canonicalToCents(value);
    const display = formatDisplay(cents);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? formatter.format(0)}
        value={display}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
          const nextCents = digits === "" ? 0 : Number.parseInt(digits, 10);
          onChange(centsToCanonical(nextCents));
        }}
      />
    );
  },
);
