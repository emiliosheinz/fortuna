import { createHash } from "node:crypto";

/**
 * Coarse browser-family classifier used as the second input to the
 * device-fingerprint hash.
 *
 * Intentionally low-resolution — the fingerprint is meant to coalesce minor
 * UA differences (Chrome version bumps, Mac vs Windows) into the same row
 * for a given `device_id`, so the new-device email doesn't fire on every
 * browser update. Anything we can't classify is `"unknown"` so we still get
 * a deterministic hash.
 */
export type UaFamily =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "opera"
  | "unknown";

/**
 * Map a raw User-Agent string to its browser family. Order matters: Edge and
 * Opera both embed `Chrome/<version>` in their UA, so they must be checked
 * first.
 */
export function deriveUaFamily(userAgent: string | null): UaFamily {
  if (!userAgent) return "unknown";
  if (/Edg\//.test(userAgent)) return "edge";
  if (/OPR\/|Opera/.test(userAgent)) return "opera";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/Chrome\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "unknown";
}

/**
 * SHA-256 hex of `device_id || ua_family`, used as the canonical
 * fingerprint identifier per user. The raw `device_id` cookie value is
 * never persisted — only this hash lives in `device_fingerprints`.
 */
export function computeDeviceFingerprintHash(
  deviceId: string,
  userAgent: string | null,
): string {
  const uaFamily = deriveUaFamily(userAgent);
  return createHash("sha256").update(`${deviceId}|${uaFamily}`).digest("hex");
}
