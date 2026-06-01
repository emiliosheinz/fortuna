import { expect, type Page, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

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
  test("sign-out clears the cookie and protects authenticated routes from the prior cookie", async ({
    page,
  }) => {
    await signInWithGoogle(page, "E2E User");
    await expect(page.getByText("Welcome, E2E User")).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth\/sign-in$/);

    await page.goto("/");
    await page.waitForURL(/\/auth\/sign-in$/);
  });

  test("revoking another device from context A invalidates context B on next request", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Same subject from two contexts → one user, two sessions; the test
      // revokes one from the other.
      await signInWithGoogle(pageA, "E2E User");
      await signInWithGoogle(pageB, "E2E User");

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
      await pageB.goto("/");
      await pageB.waitForURL(/\/auth\/sign-in$/);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
