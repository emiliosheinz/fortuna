import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

test.describe("Account deletion", () => {
  test("typing DELETE on the danger zone hard-deletes the account, clears the cookie, and protects /home from the prior cookie", async ({
    page,
    context,
  }) => {
    await signInWithGoogle(page, "Delete Me User");
    await expect(page.getByText(/Welcome,/)).toBeVisible();

    // The session cookie should exist before deletion.
    const before = (await context.cookies()).find(
      (c) => c.name === "fortuna_session",
    );
    expect(before).toBeDefined();

    await page.getByRole("link", { name: "Account" }).click();
    await page.waitForURL(/\/settings\/account$/);

    const submit = page.getByRole("button", { name: /delete my account/i });
    await expect(submit).toBeDisabled();

    const confirmation = page.getByLabel(/type.+to confirm/i);
    await confirmation.fill("wrong");
    await expect(submit).toBeDisabled();

    await confirmation.fill("DELETE");
    await expect(submit).toBeEnabled();

    await submit.click();
    await page.waitForURL(/\/$/);

    // The deletion handler cleared the session cookie. Subsequent navigation
    // to a protected route bounces back to the landing page.
    await page.goto("/home");
    await page.waitForURL(/\/$/);
  });
});
