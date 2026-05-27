import { createHash } from "node:crypto";
import {
  computeDeviceFingerprintHash,
  deriveUaFamily,
} from "./device-fingerprint-hash";

describe("deriveUaFamily", () => {
  it("returns the browser family for the common desktop browsers", () => {
    expect(
      deriveUaFamily(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe("chrome");
    expect(
      deriveUaFamily(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
      ),
    ).toBe("firefox");
    expect(
      deriveUaFamily(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toBe("safari");
    expect(
      deriveUaFamily(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ),
    ).toBe("edge");
    expect(
      deriveUaFamily(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
      ),
    ).toBe("opera");
  });

  it("falls back to 'unknown' when the family cannot be parsed", () => {
    expect(deriveUaFamily(null)).toBe("unknown");
    expect(deriveUaFamily("")).toBe("unknown");
    expect(deriveUaFamily("curl/8.4.0")).toBe("unknown");
  });

  it("coalesces minor UA differences within the same family", () => {
    const chromeMac =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const chromeWin =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
    expect(deriveUaFamily(chromeMac)).toBe(deriveUaFamily(chromeWin));
  });
});

describe("computeDeviceFingerprintHash", () => {
  it("is the SHA-256 hex of device_id || ua_family", () => {
    const deviceId = "abc123";
    const userAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const expected = createHash("sha256")
      .update(`${deviceId}|chrome`)
      .digest("hex");

    expect(computeDeviceFingerprintHash(deviceId, userAgent)).toBe(expected);
  });

  it("is deterministic — same inputs produce the same output", () => {
    const hash1 = computeDeviceFingerprintHash("device-x", "Chrome/120");
    const hash2 = computeDeviceFingerprintHash("device-x", "Chrome/120");
    expect(hash1).toBe(hash2);
  });

  it("differs when the device id changes", () => {
    const ua = "Chrome/120";
    expect(computeDeviceFingerprintHash("device-a", ua)).not.toBe(
      computeDeviceFingerprintHash("device-b", ua),
    );
  });

  it("differs when the UA family changes", () => {
    const deviceId = "device-x";
    const chrome =
      "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const firefox =
      "Mozilla/5.0 (Macintosh; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(computeDeviceFingerprintHash(deviceId, chrome)).not.toBe(
      computeDeviceFingerprintHash(deviceId, firefox),
    );
  });
});
