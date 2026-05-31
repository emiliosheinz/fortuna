"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";

export function SignOutButton() {
  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      navigateTo(CLEAR_SESSION_PATH);
    },
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Signing out…" : "Sign out"}
      </Button>
      {mutation.isError ? (
        <p
          role="alert"
          data-testid="sign-out-error"
          className="text-xs text-destructive"
        >
          Could not sign out. Please try again.
        </p>
      ) : null}
    </div>
  );
}
