"use client";

import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUGGESTED_CURRENCIES } from "../constants";
import { useSetBaseCurrency } from "../hooks";

interface BaseCurrencyFormProps {
  initial: string;
  onSaved?: (next: string) => void;
}

export function BaseCurrencyForm({ initial, onSaved }: BaseCurrencyFormProps) {
  const selectId = useId();
  const [value, setValue] = useState<string>(initial);
  const [error, setError] = useState<string | null>(null);
  const mutation = useSetBaseCurrency();

  async function handleChange(next: string) {
    if (next === value) return;
    const previous = value;
    setError(null);
    setValue(next);
    try {
      const result = await mutation.mutateAsync(next);
      const persisted = result.baseCurrency ?? next;
      if (persisted !== next) setValue(persisted);
      onSaved?.(persisted);
    } catch {
      setValue(previous);
      setError("Could not save the base currency. Try again.");
    }
  }

  return (
    <div data-testid="base-currency-form" className="flex flex-col gap-1.5">
      <Label htmlFor={selectId}>Base currency</Label>
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={mutation.isPending}
      >
        <SelectTrigger
          id={selectId}
          data-testid="base-currency-trigger"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUGGESTED_CURRENCIES.map((code) => (
            <SelectItem key={code} value={code}>
              {code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mutation.isPending ? (
        <p className="text-xs text-muted-foreground">Saving…</p>
      ) : error ? (
        <p
          role="alert"
          data-testid="base-currency-error"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
