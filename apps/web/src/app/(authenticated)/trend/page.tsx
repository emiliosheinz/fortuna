"use client";

import { format, subMonths } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { TrendView } from "@/lib/cashflow/components/trend-view";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_TREND_MONTHS = 6;

function sanitize(value: string | null): string | null {
  return value && MONTH_RE.test(value) ? value : null;
}

function defaultWindow(): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(subMonths(now, DEFAULT_TREND_MONTHS - 1), "yyyy-MM"),
    to: format(now, "yyyy-MM"),
  };
}

export default function TrendPage() {
  const router = useRouter();
  const params = useSearchParams();
  const fallback = defaultWindow();
  const from = sanitize(params.get("from")) ?? fallback.from;
  const to = sanitize(params.get("to")) ?? fallback.to;

  const onWindowChange = useCallback(
    (window: { from: string | null; to: string | null }) => {
      const next = new URLSearchParams(params.toString());
      if (window.from) {
        next.set("from", window.from);
      } else {
        next.delete("from");
      }
      if (window.to) {
        next.set("to", window.to);
      } else {
        next.delete("to");
      }
      const qs = next.toString();
      router.replace(`/trend${qs ? `?${qs}` : ""}`);
    },
    [params, router],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <TrendView from={from} to={to} onWindowChange={onWindowChange} />
    </main>
  );
}
