"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { TagDrillDownView } from "@/lib/cashflow/components/tag-drill-down-view";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function sanitize(value: string | null): string | null {
  return value && MONTH_RE.test(value) ? value : null;
}

export default function TagDrillDownPage() {
  const router = useRouter();
  const params = useSearchParams();
  const route = useParams<{ id: string }>();
  const from = sanitize(params.get("from"));
  const to = sanitize(params.get("to"));

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
      router.replace(`/tags/${route.id}${qs ? `?${qs}` : ""}`);
    },
    [params, route.id, router],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <TagDrillDownView
        tagId={route.id}
        from={from}
        to={to}
        onWindowChange={onWindowChange}
      />
    </main>
  );
}
