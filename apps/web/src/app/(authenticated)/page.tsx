"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-guard";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

export default function AuthenticatedRootPage() {
  const { me } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
      <h1 className="text-xl font-semibold">Welcome, {me.name}</h1>
      <p className="text-sm">{me.email}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/settings/sessions">Manage sessions</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/account">Account</Link>
        </Button>
        <SignOutButton />
      </div>
    </main>
  );
}
