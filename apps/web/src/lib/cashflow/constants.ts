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

/** ISO 4217 codes supported by frankfurter.app (ECB-backed). Anything outside
 *  this set still captures fine, but its base-currency rollup will be
 *  unconvertible until coverage exists. */
export const FRANKFURTER_SUPPORTED_CURRENCIES = [
  "AUD",
  "BGN",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "USD",
  "ZAR",
] as const;

export function isFrankfurterSupported(code: string): boolean {
  return (FRANKFURTER_SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}
