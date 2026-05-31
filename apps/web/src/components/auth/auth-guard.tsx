"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { apiClient } from "@/lib/api-client";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

const AuthContext = createContext<AuthenticatedUser | null>(null);

/**
 * Returns the currently signed-in user. Throws if called outside an
 * `<AuthGuard>`. Inside the guarded tree the user is always present —
 * the guard renders its children only after a successful session check.
 */
export function useAuth(): AuthenticatedUser {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be called inside <AuthGuard>");
  }
  return value;
}

/** Query key the guard owns; exported so mutations can invalidate it. */
export const AUTH_QUERY_KEY = ["auth", "me"] as const;

/**
 * Single entry point for the authenticated UI. Fetches the current user
 * once per tab via TanStack Query and exposes it through `useAuth()` to
 * any descendant client component.
 *
 * - While the initial fetch is in flight: renders a centred spinner so no
 *   authenticated content flashes for an unauthenticated visitor.
 * - On `401`: `apiClient` has already navigated to `/api/auth/clear-session`,
 *   which drops the cookie and lands the user on `/auth/sign-in`. The guard
 *   renders nothing while that navigation resolves.
 * - On success: children render inside an `AuthContext.Provider`, and
 *   `staleTime: Infinity` keeps the cache warm across navigations.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isPending, isError } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => apiClient.get<AuthenticatedUser>("/api/users/me"),
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

  if (isError || !data) {
    return null;
  }

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
}
