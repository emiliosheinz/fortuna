import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

/**
 * Renders a sign-out button inside a server-action `<form>`. Posting the
 * form invokes {@link signOutAction}, which revokes the session row and
 * clears the cookie before redirecting to the landing page.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
