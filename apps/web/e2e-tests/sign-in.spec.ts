import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

test.describe("Sign in with Google (mocked)", () => {
  test("signs in and renders the user's profile on /home", async ({ page }) => {
    await signInWithGoogle(page, "E2E User");

    await expect(page.getByText("Welcome, E2E User")).toBeVisible();
    await expect(page.getByText("e2e@example.com")).toBeVisible();
  });
});
