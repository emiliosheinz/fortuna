import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

test.describe("Sign in with Google (mocked)", () => {
  test("renders the headline and the Google G inside the CTA", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in");

    await expect(
      page.getByRole("heading", { name: /take control of your finances/i }),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/api/auth/sign-in"] img[src*="google-g"]'),
    ).toBeVisible();
  });

  test("signs in and renders the user's profile on /", async ({ page }) => {
    await signInWithGoogle(page, "E2E User");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Welcome, E2E User")).toBeVisible();
    await expect(page.getByText("e2e@example.com")).toBeVisible();
  });
});
