import type { Page } from "@playwright/test";

/**
 * Drive the mock OAuth2 server through a full sign-in for the given
 * `subject` (used as the IdP's `sub` claim, which is what distinguishes
 * users at the API). Leaves `page` on `/home` so callers can assert against
 * the authenticated surface immediately.
 */
export async function signInWithGoogle(
  page: Page,
  subject: string,
): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in with Google" }).click();
  await page.waitForURL(/mock-oauth2-server:8080\/default\/authorize/);
  await page.getByPlaceholder("Enter any user/subject").fill(subject);
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.waitForURL(/\/home$/);
}
