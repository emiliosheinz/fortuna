import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

test.describe("Authenticated header avatar menu", () => {
  test("opens via pointer, navigates to Account and Sessions, and signs out", async ({
    page,
  }) => {
    await signInWithGoogle(page, "E2E User");

    const trigger = page.getByRole("button", { name: "Account menu" });
    await expect(trigger).toBeVisible();

    await trigger.click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/settings\/account$/);
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    // Radix DropdownMenu + next/link can leave a stale 'open' state after a
    // menu-item-triggered navigation; reopen via keyboard (the same path the
    // sibling "via keyboard alone" test uses successfully).
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Sessions" }).click();
    await expect(page).toHaveURL(/\/settings\/sessions$/);
    await expect(
      page.getByRole("heading", { name: "Active sessions" }),
    ).toBeVisible();

    await trigger.focus();
    await page.keyboard.press("Enter");
    const signOut = page.getByRole("menuitem", { name: "Sign out" });
    await expect(signOut).toBeVisible();
    await signOut.click();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });

  test("opens and dismisses via keyboard alone", async ({ page }) => {
    await signInWithGoogle(page, "E2E User");

    const trigger = page.getByRole("button", { name: "Account menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("menuitem", { name: "Account" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(
      page.getByRole("menuitem", { name: "Account" }),
    ).not.toBeVisible();
  });

  test("persists the chosen theme across navigation", async ({ page }) => {
    await signInWithGoogle(page, "E2E User");

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Theme" }).hover();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await page.keyboard.press("Escape");

    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/settings/account");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
