"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigateTo(CLEAR_SESSION_PATH),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        data-testid="sign-out-button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className={className}
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
