"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { type CurrentUser, usersApi } from "@/lib/users/api-client";
import { USER_QUERY_KEY } from "@/lib/users/query-keys";

interface AuthContextValue {
  me: CurrentUser;
}

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be called inside <AuthGuard>");
  }
  return value;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: () => usersApi.getMe(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (isPending) {
    return (
      <div
        data-testid="auth-guard-loading"
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <div
          role="status"
          aria-label="Loading"
          className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
        />
      </div>
    );
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
