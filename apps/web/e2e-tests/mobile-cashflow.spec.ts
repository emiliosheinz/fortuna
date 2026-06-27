// Mobile regression guard for the new-transaction capture flow.
//
// Playwright cannot render the real on-screen keyboard, so this test only
// guards layout and scroll: at an iPhone 13 viewport, the FAB opens a
// keyboard-safe bottom sheet whose Save button is reachable (i.e. scrollable
// into the viewport) after every field is filled. The authoritative coverage
// for the keyboard itself stays the manual real-device matrix pass.

import { devices, expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  hasTouch: true,
  isMobile: iPhone13.isMobile,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
});

test.describe("Mobile cashflow capture", () => {
  test("FAB opens a bottom sheet whose Save button is reachable", async ({
    page,
  }) => {
    await signInWithGoogle(page, "Mobile Cashflow User");

    await page.getByTestId("open-capture-dialog").tap();

    const dialog = page.getByRole("dialog", { name: "New transaction" });
    await expect(dialog).toBeVisible();

    const description = `Mobile lunch ${Date.now()}`;
    await dialog.getByLabel("Description").fill(description);

    const amount = dialog.getByLabel("Amount");
    await amount.tap();
    await page.keyboard.type("1234");
    await expect(amount).not.toHaveValue("");

    const save = dialog.getByRole("button", { name: "Save transaction" });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();

    await save.tap();
    await expect(dialog).toBeHidden();

    await page.goto("/transactions");
    const list = page.getByTestId("transaction-list");
    await expect(list).toBeVisible();
    await expect(list.getByText(description)).toBeVisible();
  });
});
