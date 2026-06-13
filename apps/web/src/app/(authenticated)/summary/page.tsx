"use client";

import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { SummaryView } from "@/lib/cashflow/components/summary-view";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

export default function SummaryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("month");
  const month = raw && MONTH_RE.test(raw) ? raw : currentMonth();

  const onMonthChange = useCallback(
    (next: string) => {
      const url = new URLSearchParams(params.toString());
      url.set("month", next);
      router.replace(`/summary?${url.toString()}`);
    },
    [params, router],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <SummaryView month={month} onMonthChange={onMonthChange} />
    </main>
  );
}
