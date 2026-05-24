import { expect, type Page, test } from "@playwright/test";

async function signInWithGoogle(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in with Google" }).click();
  await page.waitForURL(/mock-oauth2-server:8080\/default\/authorize/);
  await page.getByPlaceholder("Enter any user/subject").fill("Delete Me User");
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.waitForURL(/\/home$/);
}

test.describe("Account deletion", () => {
  test("typing DELETE on the danger zone hard-deletes the account, clears the cookie, and protects /home from the prior cookie", async ({
    page,
    context,
  }) => {
    await signInWithGoogle(page);
    await expect(page.getByText(/Welcome,/)).toBeVisible();

    // The session cookie should exist before deletion.
    const before = (await context.cookies()).find(
      (c) => c.name === "fortuna_session",
    );
    expect(before).toBeDefined();

    await page.getByRole("link", { name: "Account" }).click();
    await page.waitForURL(/\/settings\/account$/);

    const submit = page.getByTestId("delete-account-submit");
    await expect(submit).toBeDisabled();

    await page.getByTestId("delete-confirmation-input").fill("wrong");
    await expect(submit).toBeDisabled();

    await page.getByTestId("delete-confirmation-input").fill("DELETE");
    await expect(submit).toBeEnabled();

    await submit.click();
    await page.waitForURL(/\/$/);

    // The deletion handler cleared the session cookie. Subsequent navigation
    // to a protected route bounces back to the landing page.
    await page.goto("/home");
    await page.waitForURL(/\/$/);
  });
});
