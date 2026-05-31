"use client";

import { useAuth } from "@/components/auth/auth-guard";
import { DeleteAccountForm } from "@/components/delete-account-form";

export default function AccountSettingsPage() {
  const { me } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold">Account</h1>

      <section className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Profile
        </h2>
        <p className="text-base">{me.name}</p>
        <p className="text-sm text-muted-foreground">{me.email}</p>
      </section>

      <section
        data-testid="danger-zone"
        className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">
          Danger zone
        </h2>
        <p className="text-sm">
          Deleting your account permanently erases your profile, sessions, and
          identity link with Google. Sign-in events are anonymized but retained
          for security forensics. This action cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
