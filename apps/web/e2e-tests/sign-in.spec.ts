import { expect, test } from "@playwright/test";

test.describe("Sign in with Google (mocked)", () => {
  test("signs in and renders the user's profile on /home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Fortuna")).toBeVisible();

    await page.getByRole("link", { name: "Sign in with Google" }).click();

    await page.waitForURL(/mock-oauth2-server:8080\/default\/authorize/);
    await expect(
      page.getByRole("heading", { name: "Mock OAuth2 Server Sign-in" }),
    ).toBeVisible();
    await page.getByPlaceholder("Enter any user/subject").fill("E2E User");
    await page.getByRole("button", { name: "Sign-in" }).click();

    await page.waitForURL(/\/home$/);
    await expect(page.getByText("Welcome, E2E User")).toBeVisible();
    await expect(page.getByTestId("user-email")).toHaveText("e2e@example.com");
  });
});
