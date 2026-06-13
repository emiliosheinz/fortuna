"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type CurrentUser, usersApi } from "@/lib/users/api-client";
import { USER_QUERY_KEY } from "@/lib/users/query-keys";
import { cn } from "@/lib/utils";

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

const NAV_KEYS = ["dashboard", "transactions", "categories", "tags"] as const;
const FOOTER_KEYS = ["theme", "collapse"] as const;

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
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar md:flex",
          sidebarOpen ? "w-64" : "w-12",
        )}
      >
        {sidebarOpen ? (
          <ExpandedSidebarSkeleton />
        ) : (
          <CollapsedSidebarSkeleton />
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

function ExpandedSidebarSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2 p-2">
        <div className="flex h-12 items-center gap-2 p-0.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1 p-2">
          {NAV_KEYS.map((key) => (
            <ExpandedRowSkeleton key={key} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2">
        <div className="flex flex-col gap-1">
          {FOOTER_KEYS.map((key) => (
            <ExpandedRowSkeleton key={key} />
          ))}
        </div>
      </div>
    </>
  );
}

function ExpandedRowSkeleton() {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md p-2">
      <Skeleton className="size-4 shrink-0" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  );
}

function CollapsedSidebarSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2 p-2">
        <div className="flex h-12 items-center justify-center">
          <Skeleton className="size-7 rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1 p-2">
          {NAV_KEYS.map((key) => (
            <Skeleton key={key} className="size-8 rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2">
        <div className="flex flex-col gap-1">
          {FOOTER_KEYS.map((key) => (
            <Skeleton key={key} className="size-8 rounded-md" />
          ))}
        </div>
      </div>
    </>
  );
}
