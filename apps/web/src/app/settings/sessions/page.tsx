import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { revokeSessionAction } from "@/lib/auth/actions";
import { listSessions } from "@/lib/auth/api-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const sessions = await listSessions(sessionValue);

  if (!sessions) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8 text-foreground">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Active sessions</h1>
        <Button asChild variant="ghost">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Sessions are listed for every device you are signed in on. Revoke any
        session you do not recognize.
      </p>

      <ul className="flex flex-col gap-3" data-testid="sessions-list">
        {sessions.map((session) => (
          <li
            key={session.id}
            data-testid="session-item"
            data-session-id={session.id}
            data-is-current={session.isCurrent ? "true" : "false"}
            className="flex items-center justify-between rounded-md border border-border p-4"
          >
            <div className="flex flex-col">
              <span className="font-medium">{session.deviceLabel}</span>
              <span className="text-xs text-muted-foreground">
                Last active{" "}
                {dateFormatter.format(new Date(session.lastActiveAt))}
                {session.isCurrent ? " · This device" : ""}
              </span>
            </div>
            {session.isCurrent ? (
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Current
              </span>
            ) : (
              <form action={revokeSessionAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  data-testid="revoke-session"
                >
                  Revoke
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
