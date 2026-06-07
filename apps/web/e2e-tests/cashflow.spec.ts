import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

test.describe("Cashflow capture", () => {
  test("captures a transaction through the modal and surfaces it in the list", async ({
    page,
  }) => {
    await signInWithGoogle(page, "Cashflow Capture User");

    await expect(
      page.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeVisible();

    await page.getByTestId("open-capture-dialog").click();

    const dialog = page.getByRole("dialog", { name: "New transaction" });
    await expect(dialog).toBeVisible();

    // Suffix the description so a rerun (the e2e compose volume is persistent
    // between local invocations) doesn't collide with the previous row.
    const description = `Lunch with team ${Date.now()}`;
    await dialog.getByLabel("Description").fill(description);

    // MoneyInput is cents-based: typing "1234" yields "12.34" in the canonical
    // payload; the visible formatting depends on the runtime locale.
    const amount = dialog.getByLabel("Amount");
    await amount.click();
    await page.keyboard.type("1234");
    await expect(amount).not.toHaveValue("");

    await dialog.getByRole("button", { name: "Save transaction" }).click();
    await expect(dialog).toBeHidden();

    const list = page.getByTestId("transaction-list");
    await expect(list).toBeVisible();
    await expect(list.getByText(description)).toBeVisible();
  });

  test("blocks submission when required fields are empty", async ({ page }) => {
    await signInWithGoogle(page, "Cashflow Validation User");

    await page.getByTestId("open-capture-dialog").click();
    const dialog = page.getByRole("dialog", { name: "New transaction" });

    await dialog.getByRole("button", { name: "Save transaction" }).click();

    await expect(dialog.getByText(/add a description/i)).toBeVisible();
    await expect(
      dialog.getByText(/non-negative amount with up to two decimals/i),
    ).toBeVisible();
  });
});

test.describe("Base currency setting", () => {
  test("auto-saves on selection and reflects the new currency on the cashflow page", async ({
    page,
  }) => {
    await signInWithGoogle(page, "Base Currency User");

    await page.getByTestId("sidebar-identity").click();
    await page.getByTestId("identity-menu-settings").click();
    await page.waitForURL(/\/settings\/preferences$/);

    // Pick whichever currency the user is not currently on, so the test is
    // idempotent across reruns of the persistent e2e Postgres volume.
    const trigger = page.getByTestId("base-currency-trigger");
    const current = (await trigger.textContent())?.trim() ?? "";
    const next = current === "EUR" ? "USD" : "EUR";

    await trigger.click();
    await page.getByRole("option", { name: next }).click();
    await expect(trigger).toContainText(next);

    await page.goto("/transactions");
    await expect(
      page.getByText(new RegExp(`Rolled up into ${next}`)),
    ).toBeVisible();
  });
});
