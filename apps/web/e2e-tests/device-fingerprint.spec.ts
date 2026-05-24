import { expect, type Page, test } from "@playwright/test";

async function signInWithGoogle(page: Page, subject: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in with Google" }).click();
  await page.waitForURL(/mock-oauth2-server:8080\/default\/authorize/);
  await page.getByPlaceholder("Enter any user/subject").fill(subject);
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.waitForURL(/\/home$/);
}

test.describe("Device fingerprint cookie", () => {
  test("persists the device_id cookie across sign-out + re-sign-in within one browser context", async ({
    context,
    page,
  }) => {
    await signInWithGoogle(page, "Device Persist User");

    const afterSignIn = (await context.cookies()).find(
      (c) => c.name === "fortuna_device_id",
    );
    expect(afterSignIn).toBeDefined();
    expect(afterSignIn?.value.length ?? 0).toBeGreaterThanOrEqual(32);
    expect(afterSignIn?.httpOnly).toBe(true);
    expect(afterSignIn?.sameSite?.toLowerCase()).toBe("lax");
    expect(afterSignIn?.path).toBe("/");
    // No Domain attribute → host-only.
    expect(afterSignIn?.domain ?? "").not.toMatch(/^\./);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/$/);

    const afterSignOut = (await context.cookies()).find(
      (c) => c.name === "fortuna_device_id",
    );
    // The device cookie must survive sign-out — it's not session-scoped.
    expect(afterSignOut?.value).toBe(afterSignIn?.value);

    await signInWithGoogle(page, "Device Persist User");

    const afterSecondSignIn = (await context.cookies()).find(
      (c) => c.name === "fortuna_device_id",
    );
    expect(afterSecondSignIn?.value).toBe(afterSignIn?.value);
  });
});
