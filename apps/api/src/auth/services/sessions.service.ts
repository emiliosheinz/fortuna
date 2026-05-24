import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, MoreThan, type Repository } from "typeorm";
import { SESSION_DURATION_MS } from "../cookies/session-cookie";
import { Session } from "../entities/session.entity";

/**
 * Minimum interval between `last_active_at`/`expires_at` writes when sliding
 * an active session. Avoids a per-request DB write under sustained traffic.
 */
export const SLIDE_THROTTLE_MS = 5 * 60 * 1000;

const RAW_TOKEN_BYTES = 32;

export interface MintInput {
  userId: string;
  userAgent: string | null;
  ip: string | null;
  /** Optional device fingerprint to link to this session. */
  deviceFingerprintId?: string | null;
}

export interface MintResult {
  rawToken: string;
  session: Session;
}

/**
 * Lifecycle for opaque server-side sessions: mint, lookup-by-raw-token, slide.
 *
 * The cookie value is generated here as 32 bytes of CSPRNG entropy; only its
 * SHA-256 hash is persisted. The raw token never round-trips through the DB.
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  /** Create a new session for `userId`. Returns the raw token (returned to
   * the client exactly once) and the persisted row. */
  async mint(input: MintInput): Promise<MintResult> {
    const rawToken = randomBytes(RAW_TOKEN_BYTES).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    const session = await this.sessions.save({
      userId: input.userId,
      tokenHash,
      deviceFingerprintId: input.deviceFingerprintId ?? null,
      userAgent: input.userAgent,
      ipAtCreation: input.ip,
      lastActiveAt: now,
      expiresAt,
      revokedAt: null,
    });

    return { rawToken, session };
  }

  /** Look up a session by id without any active-state filtering. Returns
   * null when not found — callers decide what to do with revoked/expired
   * rows (e.g. ownership checks still apply). */
  async findById(sessionId: string): Promise<Session | null> {
    return this.sessions.findOne({ where: { id: sessionId } });
  }

  /** Count every non-revoked, non-expired session across all users. Used
   * by the periodic sampler that backs the `auth_sessions_active` gauge. */
  async countActive(): Promise<number> {
    return this.sessions.count({
      where: {
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  /** List every non-revoked, non-expired session for a user, newest active
   * first. Used to render the "active sessions" UI. */
  async listActiveForUser(userId: string): Promise<Session[]> {
    return this.sessions.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { lastActiveAt: "DESC" },
    });
  }

  /** Look up an active (not revoked, not expired) session by its raw token. */
  async findActiveByRawToken(rawToken: string): Promise<Session | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  }

  /** Mark a session as revoked. Idempotent — re-revoking moves the timestamp
   * forward, which is fine: the session was already invalid. */
  async revoke(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { revokedAt: new Date() });
  }

  /**
   * Bump `last_active_at` + extend `expires_at` by the full rolling window,
   * but only when at least {@link SLIDE_THROTTLE_MS} has elapsed since the
   * last slide. Mutates the passed-in entity to keep the in-memory view in
   * sync with the persisted row.
   */
  async maybeSlide(session: Session): Promise<void> {
    const now = Date.now();
    const staleSinceMs = now - session.lastActiveAt.getTime();
    if (staleSinceMs < SLIDE_THROTTLE_MS) return;

    const nextLastActive = new Date(now);
    const nextExpires = new Date(now + SESSION_DURATION_MS);
    await this.sessions.update(
      { id: session.id },
      { lastActiveAt: nextLastActive, expiresAt: nextExpires },
    );
    session.lastActiveAt = nextLastActive;
    session.expiresAt = nextExpires;
  }
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
