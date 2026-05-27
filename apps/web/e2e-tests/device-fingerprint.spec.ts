import { expect, test } from "@playwright/test";
import { signInWithGoogle } from "./helpers/auth";

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
