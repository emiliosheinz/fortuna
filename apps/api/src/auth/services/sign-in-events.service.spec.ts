import { hashUserAgent } from "./sign-in-events.service";

describe("hashUserAgent", () => {
  it("returns the SHA-256 hex digest of the input", () => {
    const ua = "Mozilla/5.0";
    const digest = hashUserAgent(ua);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    // Stable across runs.
    expect(hashUserAgent(ua)).toBe(digest);
  });

  it("returns null when the user-agent is null or empty", () => {
    expect(hashUserAgent(null)).toBeNull();
    expect(hashUserAgent("")).toBeNull();
  });
});
