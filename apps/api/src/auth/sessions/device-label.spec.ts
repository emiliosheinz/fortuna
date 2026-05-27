import { deriveDeviceLabel } from "./device-label";

describe("deriveDeviceLabel", () => {
  it("identifies Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(deriveDeviceLabel(ua)).toBe("Chrome on macOS");
  });

  it("identifies Safari on iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(deriveDeviceLabel(ua)).toBe("Safari on iOS");
  });

  it("identifies Firefox on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(deriveDeviceLabel(ua)).toBe("Firefox on Windows");
  });

  it("identifies Chrome on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; SM-G998U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(deriveDeviceLabel(ua)).toBe("Chrome on Android");
  });

  it("identifies Edge before falling through to Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(deriveDeviceLabel(ua)).toBe("Edge on Windows");
  });

  it("falls back when UA is missing", () => {
    expect(deriveDeviceLabel(null)).toBe("Unknown device");
    expect(deriveDeviceLabel("")).toBe("Unknown device");
  });

  it("falls back when UA is unrecognized", () => {
    expect(deriveDeviceLabel("curl/8.0.1")).toBe("Unknown device");
  });
});
