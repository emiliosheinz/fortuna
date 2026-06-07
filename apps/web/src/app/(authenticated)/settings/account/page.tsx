"use client";

import { useAuth } from "@/components/auth/auth-guard";
import { DeleteAccountForm } from "@/components/delete-account-form";

export default function AccountSettingsPage() {
  const { me } = useAuth();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Your profile and account-level actions.
        </p>
      </header>

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
