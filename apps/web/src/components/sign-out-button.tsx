"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiClient, CLEAR_SESSION_PATH } from "@/lib/api-client";
import { navigateTo } from "@/lib/navigate";

/**
 * Sign-out trigger. Calls `DELETE /api/auth/session` to revoke the server
 * session, then hands off to the clear-session route handler to drop the
 * cookie and land on `/auth/sign-in`. A 401 mid-flight means the session
 * was already invalid, which `apiClient` translates into the same redirect
 * — no extra branching needed here.
 */
export function SignOutButton() {
  const signOut = useMutation({
    mutationFn: () => apiClient.delete("/api/auth/session"),
    onSuccess: () => {
      navigateTo(CLEAR_SESSION_PATH);
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate()}
    >
      Sign out
    </Button>
  );
}
