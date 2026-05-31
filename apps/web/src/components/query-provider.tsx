"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

/**
 * Wraps the app in TanStack Query's `QueryClientProvider`.
 *
 * `useState` is the recommended way to instantiate the `QueryClient` in the
 * App Router: it survives Fast Refresh but is recreated when a new request
 * mounts the tree on the server, so React Server Components and client
 * components share a single per-request client. The defaults below favor
 * predictability over aggressive freshness — individual queries can override
 * `staleTime` when they need different semantics.
 *
 * Devtools render only when `NODE_ENV !== "production"`; in prod the import
 * stays in the bundle but the component returns null, so there's no runtime
 * overhead beyond the (small) import cost.
 */
interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== "production" ? (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      ) : null}
    </QueryClientProvider>
  );
}
