import {
  devices,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

const pixel5 = devices["Pixel 5"];

test.use({
  viewport: pixel5.viewport,
  hasTouch: true,
  isMobile: pixel5.isMobile,
  userAgent: pixel5.userAgent,
  deviceScaleFactor: pixel5.deviceScaleFactor,
});

async function expectWithinViewport(page: Page, locator: Locator) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test.describe("Mobile sidebar popovers", () => {
  test("identity popover opens fully inside the viewport", async ({ page }) => {
    await signInWithGoogle(page, "Mobile Sidebar User");

    await page.getByTestId("mobile-sidebar-trigger").tap();
    await expect(page.locator('[data-mobile="true"]')).toBeVisible();

    const identityMenu = page.getByTestId("sidebar-identity-menu");
    await page.getByTestId("sidebar-identity").tap();
    await expect(identityMenu).toBeVisible();
    await expectWithinViewport(page, identityMenu);
  });

  test("theme popover opens fully inside the viewport", async ({ page }) => {
    await signInWithGoogle(page, "Mobile Sidebar User");

    await page.getByTestId("mobile-sidebar-trigger").tap();
    await expect(page.locator('[data-mobile="true"]')).toBeVisible();

    const themeMenu = page.getByTestId("sidebar-theme-menu");
    await page.getByTestId("sidebar-theme-toggle").tap();
    await expect(themeMenu).toBeVisible();
    await expectWithinViewport(page, themeMenu);
  });
});
