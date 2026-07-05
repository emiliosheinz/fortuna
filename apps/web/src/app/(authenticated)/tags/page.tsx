"use client";

import { TagsManager } from "@/lib/cashflow/components/tags-manager";

export default function TagsSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Tags</h1>
      <p className="text-sm text-muted-foreground">
        Tags group transactions so a single transaction can carry many. Deleting
        a tag detaches it from existing transactions without removing them.
      </p>
      <TagsManager />
    </main>
  );
}
