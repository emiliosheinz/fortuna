"use client";

import { SessionsSection } from "@/lib/sessions/components/sessions-section";

export default function SessionsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Devices currently signed into your account.
        </p>
      </header>
      <SessionsSection />
    </main>
  );
}
