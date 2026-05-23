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
 * Per-device server-side session for a {@link User}.
 *
 * `tokenHash` is SHA-256 of the opaque cookie value — the raw token is never
 * persisted, so a database read alone cannot impersonate a user. The composite
 * `(user_id, revoked_at, expires_at)` index serves active-session lookups.
 */
@Entity({ name: "sessions" })
@Index("sessions_user_active_idx", ["userId", "revokedAt", "expiresAt"])
export class Session {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(
    () => User,
    (user) => user.sessions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ name: "token_hash", type: "text", unique: true })
  declare tokenHash: string;

  @Column({ name: "user_agent", type: "text", nullable: true })
  declare userAgent: string | null;

  @Column({ name: "ip_at_creation", type: "inet", nullable: true })
  declare ipAtCreation: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @Column({ name: "last_active_at", type: "timestamptz" })
  declare lastActiveAt: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  declare expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  declare revokedAt: Date | null;
}
