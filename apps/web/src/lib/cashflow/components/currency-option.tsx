import { CURRENCY_FLAGS, type SUPPORTED_CURRENCIES } from "../constants";

type Code = (typeof SUPPORTED_CURRENCIES)[number];

export function CurrencyOption({ code }: { code: Code }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">{CURRENCY_FLAGS[code]}</span>
      <span>{code}</span>
    </span>
  );
}
