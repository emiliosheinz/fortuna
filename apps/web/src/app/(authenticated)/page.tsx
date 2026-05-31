"use client";

import { useAuth } from "@/components/auth/auth-guard";

export default function AuthenticatedRootPage() {
  const { me } = useAuth();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Welcome, {me.name}</h1>
      <p className="text-sm text-muted-foreground">{me.email}</p>
    </main>
  );
}
