"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type CurrentUser, usersApi } from "@/lib/users/api-client";
import { cn } from "@/lib/utils";
import { USER_QUERY_KEY } from "@/lib/users/query-keys";

interface AuthContextValue {
  me: CurrentUser;
}

interface AuthGuardProps {
  children: React.ReactNode;
  sidebarOpen?: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be called inside <AuthGuard>");
  }
  return value;
}

export function AuthGuard({ children, sidebarOpen = true }: AuthGuardProps) {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: () => usersApi.getMe(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (isPending) {
    return <AuthGuardSkeleton sidebarOpen={sidebarOpen} />;
  }

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="auth-guard-error"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground"
      >
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We could not load your account. Check your connection and try again.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ me: data }}>{children}</AuthContext.Provider>
  );
}

function AuthGuardSkeleton({ sidebarOpen }: { sidebarOpen: boolean }) {
  return (
    <div
      data-testid="auth-guard-loading"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen bg-background"
    >
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col gap-3 border-r border-border bg-background",
          sidebarOpen ? "w-64 p-4" : "w-12 p-2",
        )}
      >
        {sidebarOpen ? (
          <>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-10 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
          </>
        ) : (
          <>
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </>
        )}
      </aside>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-7 w-1/2" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
