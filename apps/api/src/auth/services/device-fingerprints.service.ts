import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, type Repository } from "typeorm";
import { DeviceFingerprint } from "../entities/device-fingerprint.entity";
import { computeDeviceFingerprintHash } from "../fingerprint/device-fingerprint-hash";

/** Postgres SQLSTATE for unique-violation; surfaced via the pg driver. */
const PG_UNIQUE_VIOLATION = "23505";

export interface RecordSignInInput {
  userId: string;
  deviceId: string | null;
  userAgent: string | null;
}

export interface RecordSignInResult {
  /** Persisted fingerprint id, or null when no `device_id` was supplied. */
  fingerprintId: string | null;
  /** True iff this sign-in produced a brand-new fingerprint row. */
  isNew: boolean;
}

/**
 * Upserts a {@link DeviceFingerprint} row per `(userId, device_id, ua_family)`
 * and reports whether the sign-in came from a previously-unseen device.
 *
 * The downstream new-device email worker (Phase 6) consumes the `isNew` flag.
 * The raw `device_id` cookie value is never persisted — only its hash via
 * {@link computeDeviceFingerprintHash} reaches the database.
 */
@Injectable()
export class DeviceFingerprintsService {
  constructor(
    @InjectRepository(DeviceFingerprint)
    private readonly fingerprints: Repository<DeviceFingerprint>,
  ) {}

  /**
   * Find or create the fingerprint matching `(userId, hash(deviceId, uaFamily))`.
   * Updates `last_seen_at` on a known fingerprint; inserts otherwise. Returns
   * `{ fingerprintId: null, isNew: false }` when no `device_id` cookie was
   * forwarded — the caller still mints a session, just with no fingerprint
   * link.
   *
   * A unique-violation race between two concurrent first-time sign-ins for
   * the same `(user_id, fingerprint_hash)` resolves by re-fetching the
   * winning row and reporting `isNew=false` to the loser.
   */
  async recordSignIn(input: RecordSignInInput): Promise<RecordSignInResult> {
    if (!input.deviceId) {
      return { fingerprintId: null, isNew: false };
    }

    const fingerprintHash = computeDeviceFingerprintHash(
      input.deviceId,
      input.userAgent,
    );

    const existing = await this.fingerprints.findOne({
      where: { userId: input.userId, fingerprintHash },
    });

    if (existing) {
      await this.fingerprints.update(
        { id: existing.id },
        { lastSeenAt: new Date() },
      );
      return { fingerprintId: existing.id, isNew: false };
    }

    try {
      const saved = await this.fingerprints.save({
        userId: input.userId,
        fingerprintHash,
        lastSeenAt: new Date(),
      });
      return { fingerprintId: saved.id, isNew: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const winner = await this.fingerprints.findOne({
        where: { userId: input.userId, fingerprintHash },
      });
      if (!winner) throw err;
      return { fingerprintId: winner.id, isNew: false };
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code = (err as QueryFailedError & { code?: string }).code;
  if (code === PG_UNIQUE_VIOLATION) return true;
  const nested = (err as QueryFailedError & { driverError?: { code?: string } })
    .driverError;
  return nested?.code === PG_UNIQUE_VIOLATION;
}
