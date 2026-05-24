import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/auth/api-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const me = await getMe(sessionValue);
  if (!me) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8 text-foreground">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Button asChild variant="ghost">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>

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
