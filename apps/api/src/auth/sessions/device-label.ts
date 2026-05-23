/**
 * Derive a short, human-friendly device label (`"Chrome on macOS"`) from a
 * raw User-Agent string. Used by the sessions list to help users recognize
 * which device a given session belongs to.
 *
 * Intentionally narrow — covers the common browser/OS pairs and returns
 * `"Unknown device"` for everything else. The label is for human
 * recognition, not security.
 */
export function deriveDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent);
  if (!browser || !os) return "Unknown device";
  return `${browser} on ${os}`;
}

function detectBrowser(ua: string): string | null {
  // Order matters: Edge and Opera both put "Chrome/<version>" in their UA.
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  return null;
}

function detectOs(ua: string): string | null {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}
