import { expect, test } from "@playwright/test";

const SESSION_COOKIE_NAME = "fortuna_session";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_HOPS = 3;

function trackRedirects(page: import("@playwright/test").Page): string[] {
  const hops: string[] = [];
  page.on("response", (resp) => {
    if (REDIRECT_STATUSES.has(resp.status())) {
      hops.push(`${resp.status()} ${new URL(resp.url()).pathname}`);
    }
  });
  return hops;
}

async function plantBogusSessionCookie(
  context: import("@playwright/test").BrowserContext,
  baseURL: string,
): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: "not.a.valid.session.token",
      domain: hostname,
      path: "/",
      httpOnly: false,
      secure: false,
    },
  ]);
}

test.describe("Redirect-loop hardening", () => {
  test("a malformed session cookie at / terminates at /auth/sign-in within the hop budget", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("baseURL not configured");
    await plantBogusSessionCookie(context, baseURL);
    const hops = trackRedirects(page);

    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    expect(hops.length).toBeLessThanOrEqual(MAX_HOPS);
    const cookies = await context.cookies();
    expect(
      cookies.find((c) => c.name === SESSION_COOKIE_NAME)?.value ?? "",
    ).toBe("");
  });

  test("a malformed session cookie at /auth/sign-in terminates at /auth/sign-in within the hop budget", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("baseURL not configured");
    await plantBogusSessionCookie(context, baseURL);
    const hops = trackRedirects(page);

    await page.goto("/auth/sign-in");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    expect(hops.length).toBeLessThanOrEqual(MAX_HOPS);
    const cookies = await context.cookies();
    expect(
      cookies.find((c) => c.name === SESSION_COOKIE_NAME)?.value ?? "",
    ).toBe("");
  });

  test("a malformed session cookie at /settings/account terminates at /auth/sign-in within the hop budget", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("baseURL not configured");
    await plantBogusSessionCookie(context, baseURL);
    const hops = trackRedirects(page);

    await page.goto("/settings/account");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);

    expect(hops.length).toBeLessThanOrEqual(MAX_HOPS);
  });
});
