const CURRENCY_LOCALES: Record<string, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  CAD: "en-CA",
  AUD: "en-AU",
  CHF: "de-CH",
  CNY: "zh-CN",
  ARS: "es-AR",
  MXN: "es-MX",
};

const FALLBACK_LOCALE = "en-US";

function localeFor(currency: string): string {
  return CURRENCY_LOCALES[currency.toUpperCase()] ?? FALLBACK_LOCALE;
}

/**
 * Renders a monetary amount in the currency's native locale conventions.
 * `amount` may be a canonical string ("1234.56") or a number.
 */
export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(localeFor(currency), {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
