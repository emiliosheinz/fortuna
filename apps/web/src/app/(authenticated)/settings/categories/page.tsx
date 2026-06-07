"use client";

import { CategoriesManager } from "@/lib/cashflow/components/categories-manager";

export default function CategoriesSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <p className="text-sm text-muted-foreground">
        Categories group transactions for the monthly summary view. Deleting a
        category unlinks it from existing transactions without removing them.
      </p>
      <CategoriesManager />
    </main>
  );
}
