import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { fetchMe } from "@/lib/auth/api-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const me = await fetchMe(sessionValue);

  if (!me) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
      <h1 className="text-xl font-semibold">Welcome, {me.name}</h1>
      <p className="text-sm" data-testid="user-email">
        {me.email}
      </p>
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
