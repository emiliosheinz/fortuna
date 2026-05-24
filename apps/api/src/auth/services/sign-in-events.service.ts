import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  type EntityManager,
  IsNull,
  LessThan,
  Not,
  type Repository,
} from "typeorm";
import {
  SignInEvent,
  type SignInOutcome,
} from "../entities/sign-in-event.entity";

/** Retention window after which `ip` + `ua_hash` are purged. */
export const SIGN_IN_EVENT_RETENTION_DAYS = 90;

export interface RecordSignInEventInput {
  userId: string | null;
  correlationId: string;
  outcome: SignInOutcome;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Append-only audit log of `POST /auth/google` outcomes.
 *
 * The raw user-agent is never persisted — only its SHA-256 hash — so
 * forensic timelines stay useful without storing a PII string. Account
 * deletion anonymizes rows via {@link anonymizeForUser}; the retention sweep
 * clears `ip` + `ua_hash` on rows older than {@link SIGN_IN_EVENT_RETENTION_DAYS}.
 */
@Injectable()
export class SignInEventsService {
  constructor(
    @InjectRepository(SignInEvent)
    private readonly events: Repository<SignInEvent>,
  ) {}

  /** Persist a single sign-in attempt. */
  async record(input: RecordSignInEventInput): Promise<SignInEvent> {
    return this.events.save({
      userId: input.userId,
      correlationId: input.correlationId,
      outcome: input.outcome,
      ip: input.ip,
      uaHash: hashUserAgent(input.userAgent),
    });
  }

  /**
   * Clear `user_id`, `ip`, and `ua_hash` on every row belonging to `userId`.
   * Outcome + timestamp are retained so the security audit trail survives a
   * self-service account deletion. Runs inside the caller's transaction when
   * a manager is provided.
   */
  async anonymizeForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager ? manager.getRepository(SignInEvent) : this.events;
    const result = await repo.update(
      { userId },
      { userId: null, ip: null, uaHash: null },
    );
    return result.affected ?? 0;
  }

  /**
   * Null out `ip` and `ua_hash` on rows older than the retention window.
   * Leaves `outcome` + `created_at` for long-term abuse analysis.
   */
  async pruneOlderThan(cutoff: Date): Promise<number> {
    const result = await this.events
      .createQueryBuilder()
      .update(SignInEvent)
      .set({ ip: null, uaHash: null })
      .where({ createdAt: LessThan(cutoff) })
      .andWhere([{ ip: Not(IsNull()) }, { uaHash: Not(IsNull()) }])
      .execute();
    return result.affected ?? 0;
  }
}

/**
 * SHA-256 hex digest of a user-agent string. Returns `null` for absent UAs
 * so we never store an empty-string hash (a recognizable sentinel).
 */
export function hashUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return createHash("sha256").update(userAgent).digest("hex");
}
