import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-8 text-foreground">
      <h1 className="text-xl font-semibold">Welcome, {me.name}</h1>
      <p className="text-sm" data-testid="user-email">
        {me.email}
      </p>
    </main>
  );
}
