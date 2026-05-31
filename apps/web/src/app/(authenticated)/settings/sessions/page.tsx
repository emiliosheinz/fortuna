"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { sessionsApi } from "@/lib/sessions/api-client";
import { SESSIONS_QUERY_KEY } from "@/lib/sessions/query-keys";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function SessionsPage() {
  const queryClient = useQueryClient();

  const sessions = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => sessionsApi.list(),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => sessionsApi.revoke(sessionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Active sessions</h1>

      <p className="text-sm text-muted-foreground">
        Sessions are listed for every device you are signed in on. Revoke any
        session you do not recognize.
      </p>

      {revoke.isError ? (
        <p
          role="alert"
          data-testid="revoke-session-error"
          className="text-sm text-destructive"
        >
          Could not revoke that session. Please try again.
        </p>
      ) : null}

      {sessions.isPending ? (
        <div
          data-testid="sessions-loading"
          className="flex items-center justify-center py-12"
        >
          <div
            role="status"
            aria-label="Loading sessions"
            className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
          />
        </div>
      ) : sessions.isError ? (
        <div
          role="alert"
          data-testid="sessions-error"
          className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
        >
          <p className="text-sm text-destructive">
            Could not load your sessions. Check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={sessions.isFetching}
            onClick={() => sessions.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : sessions.data.length === 0 ? (
        <p
          data-testid="sessions-empty"
          className="text-sm text-muted-foreground"
        >
          You have no active sessions.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="sessions-list">
          {sessions.data.map((session) => {
            const isRevoking =
              revoke.isPending && revoke.variables === session.id;
            return (
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
                    disabled={isRevoking}
                    onClick={() => revoke.mutate(session.id)}
                  >
                    {isRevoking ? "Revoking…" : "Revoke"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
