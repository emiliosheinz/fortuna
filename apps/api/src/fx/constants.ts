/**
 * Earliest transaction date for which we provide FX conversion. The
 * self-healing catch-up job fills `fx_rates` from this date through today on
 * every run. Transactions dated before this floor are stored as captured but
 * have no base-currency rollup.
 */
export const FX_COVERAGE_START_DATE = "2026-01-01";

/** The pivot used by the FX provider (ECB-anchored via frankfurter.app). */
export const FX_BASE_CURRENCY = "EUR" as const;

/** Currencies the product supports for transactions and base-currency. */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "BRL", "GBP"] as const;

/**
 * Quote currencies persisted in `fx_rates`. EUR is the pivot, so EUR->EUR is
 * identity and not stored. Anything Frankfurter returns outside this set is
 * dropped on ingest to keep storage focused on what the UI exposes.
 */
export const SUPPORTED_QUOTE_CURRENCIES = SUPPORTED_CURRENCIES.filter(
  (code) => code !== FX_BASE_CURRENCY,
) as readonly string[];

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}
