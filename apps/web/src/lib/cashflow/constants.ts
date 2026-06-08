/**
 * Currencies the product supports for transactions and the user's base
 * currency. Mirrors `SUPPORTED_CURRENCIES` on the API; the DTO validators
 * reject anything outside this set so keeping the lists in sync is enough.
 */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "BRL", "GBP"] as const;

export const CURRENCY_FLAGS: Record<
  (typeof SUPPORTED_CURRENCIES)[number],
  string
> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  BRL: "🇧🇷",
  GBP: "🇬🇧",
};

export const TRANSACTION_KINDS = ["expense", "income"] as const;
