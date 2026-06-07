/** Curated set of currencies surfaced in the capture form. Free typing is
 *  preserved so any ISO 4217 code remains capturable. */
export const SUGGESTED_CURRENCIES = [
  "USD",
  "EUR",
  "BRL",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "MXN",
] as const;

export const TRANSACTION_KINDS = ["expense", "income"] as const;
