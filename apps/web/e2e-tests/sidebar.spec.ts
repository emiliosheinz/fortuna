import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

test.describe("Authenticated sidebar", () => {
  test("identity row navigates to the account page", async ({ page }) => {
    await signInWithGoogle(page, "E2E User");

    await page.getByTestId("sidebar-identity").click();

    await expect(page).toHaveURL(/\/settings\/account$/);
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  });

  test("persists the chosen theme across navigation", async ({ page }) => {
    await signInWithGoogle(page, "E2E User");

    await page.getByTestId("sidebar-theme-toggle").click();
    await page.getByTestId("theme-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/settings/account");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("collapse toggle shrinks the sidebar and persists across reloads", async ({
    page,
  }) => {
    await signInWithGoogle(page, "E2E User");

    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    await page.getByTestId("sidebar-collapse-toggle").click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");

    await page.reload();
    await expect(page.getByTestId("sidebar")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
  });
});
