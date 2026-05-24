"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteAccountAction } from "@/lib/auth/actions";
import { DELETE_ACCOUNT_CONFIRMATION_PHRASE } from "@/lib/auth/constants";

/**
 * Client form that gates the destructive delete-account submit on the user
 * typing the exact confirmation phrase. The server action re-validates the
 * phrase and the API requires `confirm: true`, so this is a UX guard, not
 * the only line of defence.
 */
export function DeleteAccountForm() {
  const [phrase, setPhrase] = useState("");
  const canSubmit = phrase === DELETE_ACCOUNT_CONFIRMATION_PHRASE;

  return (
    <form action={deleteAccountAction} className="flex flex-col gap-3">
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
        data-testid="delete-confirmation-input"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        type="submit"
        variant="destructive"
        disabled={!canSubmit}
        data-testid="delete-account-submit"
      >
        Delete my account
      </Button>
    </form>
  );
}
