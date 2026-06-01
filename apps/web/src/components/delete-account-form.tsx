"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { DELETE_ACCOUNT_CONFIRMATION_PHRASE } from "@/lib/auth/constants";
import { navigateTo } from "@/lib/navigate";
import { usersApi } from "@/lib/users/api-client";

export function DeleteAccountForm() {
  const [phrase, setPhrase] = useState("");
  const canSubmit = phrase === DELETE_ACCOUNT_CONFIRMATION_PHRASE;

  const mutation = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: () => {
      navigateTo(CLEAR_SESSION_PATH);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        mutation.mutate();
      }}
      className="flex flex-col gap-3"
    >
      <label
        htmlFor="delete-confirmation"
        className="text-sm text-muted-foreground"
      >
        Type{" "}
        <span className="font-mono font-semibold text-foreground">
          {DELETE_ACCOUNT_CONFIRMATION_PHRASE}
        </span>{" "}
        to confirm.
      </label>
      <input
        id="delete-confirmation"
        name="confirmation"
        type="text"
        autoComplete="off"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        type="submit"
        variant="destructive"
        disabled={!canSubmit || mutation.isPending}
      >
        {mutation.isPending ? "Deleting…" : "Delete my account"}
      </Button>
      {mutation.isError ? (
        <p
          role="alert"
          data-testid="delete-account-error"
          className="text-xs text-destructive"
        >
          Could not delete your account. Please try again.
        </p>
      ) : null}
    </form>
  );
}
