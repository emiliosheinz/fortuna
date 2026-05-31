"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient, CLEAR_SESSION_PATH } from "@/lib/api-client";
import { DELETE_ACCOUNT_CONFIRMATION_PHRASE } from "@/lib/auth/constants";
import { navigateTo } from "@/lib/navigate";

/**
 * Gates the destructive delete-account submit on the user typing the exact
 * confirmation phrase. The phrase check is a UX guard — the API also
 * requires `confirm: true`, so a phrase-bypass attempt still fails server-side.
 *
 * On success the session is gone server-side and we hand off to the
 * clear-session route handler, which drops the cookie and lands the user
 * on `/auth/sign-in`.
 */
export function DeleteAccountForm() {
  const [phrase, setPhrase] = useState("");
  const canSubmit = phrase === DELETE_ACCOUNT_CONFIRMATION_PHRASE;

  const deleteAccount = useMutation({
    mutationFn: () =>
      apiClient.delete("/api/users/me", { body: { confirm: true } }),
    onSuccess: () => {
      navigateTo(CLEAR_SESSION_PATH);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        deleteAccount.mutate();
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
        disabled={!canSubmit || deleteAccount.isPending}
      >
        Delete my account
      </Button>
    </form>
  );
}
