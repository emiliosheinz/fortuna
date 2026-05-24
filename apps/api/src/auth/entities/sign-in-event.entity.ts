import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Outcome of a `POST /auth/google` sign-in attempt.
 *
 * `success` covers a fully verified sign-in; the `failure_*` reasons mirror
 * the design's internal classifications and are server-only — the client
 * always sees the same generic error.
 */
export type SignInOutcome =
  | "success"
  | "failure_token_signature"
  | "failure_token_expired"
  | "failure_token_issuer"
  | "failure_token_audience"
  | "failure_token_malformed"
  | "failure_nonce_mismatch"
  | "failure_bad_request"
  | "failure_rate_limited"
  | "failure_internal";

/**
 * Audit trail row for a single sign-in attempt.
 *
 * `user_id` is `ON DELETE SET NULL` so deleting a user anonymizes the row
 * without losing the forensic timeline. `ip` and `ua_hash` are nullable so
 * they can be cleared by the LGPD-driven account-delete transaction and by
 * the 90-day retention sweep.
 */
@Entity({ name: "sign_in_events" })
@Index("sign_in_events_user_created_idx", ["userId", "createdAt"])
@Index("sign_in_events_created_idx", ["createdAt"])
export class SignInEvent {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  declare userId: string | null;

  @ManyToOne(
    () => User,
    (user) => user.signInEvents,
    { onDelete: "SET NULL", nullable: true },
  )
  @JoinColumn({ name: "user_id" })
  declare user: User | null;

  @Column({ name: "correlation_id", type: "uuid" })
  declare correlationId: string;

  @Column({ type: "text" })
  declare outcome: SignInOutcome;

  @Column({ type: "inet", nullable: true })
  declare ip: string | null;

  @Column({ name: "ua_hash", type: "text", nullable: true })
  declare uaHash: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;
}
