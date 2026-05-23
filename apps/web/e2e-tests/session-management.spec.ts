import { expect, type Page, test } from "@playwright/test";

async function signInWithGoogle(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in with Google" }).click();
  await page.waitForURL(/mock-oauth2-server:8080\/default\/authorize/);
  await page.getByPlaceholder("Enter any user/subject").fill("E2E User");
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.waitForURL(/\/home$/);
}

/** Read the principal's own session id from the sessions page. */
async function readCurrentSessionId(page: Page): Promise<string> {
  await page.goto("/settings/sessions");
  const current = page
    .locator('[data-testid="session-item"][data-is-current="true"]')
    .first();
  await expect(current).toBeVisible();
  const id = await current.getAttribute("data-session-id");
  if (!id) throw new Error("expected a current session row with an id");
  return id;
}

test.describe("Session management", () => {
  test("sign-out clears the cookie and protects /home from the prior cookie", async ({
    page,
  }) => {
    await signInWithGoogle(page);
    await expect(page.getByText("Welcome, E2E User")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/$/);

    await page.goto("/home");
    await page.waitForURL(/\/$/);
  });

  test("revoking another device from context A invalidates context B on next request", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await signInWithGoogle(pageA);
      await signInWithGoogle(pageB);

      const bSessionId = await readCurrentSessionId(pageB);

      await pageA.goto("/settings/sessions");
      const target = pageA.locator(
        `[data-testid="session-item"][data-session-id="${bSessionId}"]`,
      );
      await expect(target).toBeVisible();
      await target.getByRole("button", { name: "Revoke" }).click();

      // After server action revalidation, the row should be gone.
      await expect(target).toHaveCount(0);

      // Context B can no longer authenticate — protected page bounces.
      await pageB.goto("/home");
      await pageB.waitForURL(/\/$/);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
