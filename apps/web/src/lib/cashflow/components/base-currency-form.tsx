"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const result = await mutation.mutateAsync(value);
      const persisted = result.baseCurrency ?? value;
      onSaved?.(persisted);
    } catch {
      setError("Could not save the base currency. Try again.");
    }
  }

  return (
    <form
      data-testid="base-currency-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={selectId}>Base currency</Label>
        <Select value={value} onValueChange={setValue}>
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
        <p className="text-xs text-muted-foreground">
          Every transaction is rolled up into this currency on read.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="base-currency-error"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Update base currency"}
      </Button>
    </form>
  );
}
