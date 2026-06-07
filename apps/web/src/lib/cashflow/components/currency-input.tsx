"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { FRANKFURTER_SUPPORTED_CURRENCIES } from "../constants";

interface CurrencyInputProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  "aria-invalid"?: boolean;
}

/**
 * Free-typed ISO 4217 input. Supported codes are surfaced as a datalist for
 * quick discovery, but any 3-letter code remains valid at the form layer —
 * the server records the row regardless and flags `unconvertible` on read
 * when no rate path exists.
 */
export function CurrencyInput({
  id,
  value,
  onChange,
  ...rest
}: CurrencyInputProps) {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={3}
        data-testid="capture-form-currency-input"
        onChange={(event) =>
          onChange(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
        }
        aria-invalid={rest["aria-invalid"]}
      />
      <datalist id={listId}>
        {FRANKFURTER_SUPPORTED_CURRENCIES.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
    </>
  );
}
