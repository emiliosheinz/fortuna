import { devices, expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

const pixel5 = devices["Pixel 5"];

test.use({
  viewport: pixel5.viewport,
  hasTouch: true,
  isMobile: pixel5.isMobile,
  userAgent: pixel5.userAgent,
  deviceScaleFactor: pixel5.deviceScaleFactor,
});

test.describe("Mobile sidebar popovers", () => {
  test("identity popover opens after tapping the trigger", async ({ page }) => {
    await signInWithGoogle(page, "Mobile Sidebar User");

    await page.getByTestId("mobile-sidebar-trigger").tap();
    await expect(page.locator('[data-mobile="true"]')).toBeVisible();

    await page.getByTestId("sidebar-identity").tap();
    await expect(page.getByTestId("sidebar-identity-menu")).toBeVisible();
  });

  test("theme popover opens after tapping the trigger", async ({ page }) => {
    await signInWithGoogle(page, "Mobile Sidebar User");

    await page.getByTestId("mobile-sidebar-trigger").tap();
    await expect(page.locator('[data-mobile="true"]')).toBeVisible();

    await page.getByTestId("sidebar-theme-toggle").tap();
    await expect(page.getByTestId("sidebar-theme-menu")).toBeVisible();
  });
});
