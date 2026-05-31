"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

interface SessionListItem {
  id: string;
  deviceLabel: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

const SESSIONS_QUERY_KEY = ["sessions", "list"] as const;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function SessionsPage() {
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => apiClient.get<SessionListItem[]>("/api/users/me/sessions"),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.delete(
        `/api/users/me/sessions/${encodeURIComponent(sessionId)}`,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold">Active sessions</h1>

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
              <Button
                type="button"
                variant="destructive"
                data-testid="revoke-session"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(session.id)}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
