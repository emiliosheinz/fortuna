import { expect, test } from "@playwright/test";

test.describe("Public and authenticated routing", () => {
  test("redirects an unauthenticated visit to / over to the sign-in page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await expect(page.getByAltText("Fortuna")).toBeVisible();
  });

  test("redirects an unauthenticated visit to /settings/sessions over to the sign-in page", async ({
    page,
  }) => {
    await page.goto("/settings/sessions");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });

  test("does not enter a redirect loop when an unauthenticated user lands on /", async ({
    page,
  }) => {
    const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
    const redirectHops: string[] = [];
    page.on("response", (resp) => {
      if (REDIRECT_STATUSES.has(resp.status())) {
        redirectHops.push(`${resp.status()} ${new URL(resp.url()).pathname}`);
      }
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    // Exactly one server-side redirect happens: /api/auth/clear-session
    // 307s to /auth/sign-in after the AuthGuard's /users/me probe returns 401.
    expect(redirectHops.length).toBeLessThanOrEqual(2);
  });
});
