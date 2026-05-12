import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
  test("loads and renders the app name", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Fortuna")).toBeVisible();
  });
});
