import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Session } from "./session.entity";
import { User } from "./user.entity";

/**
 * A device known to a {@link User}, identified by a SHA-256 hash of the
 * long-lived `device_id` cookie plus the UA family.
 *
 * Used solely to decide whether to emit a new-device email on sign-in. The
 * raw `device_id` cookie value never leaves the browser — only its hash is
 * persisted. Cascade contract: deleting the user erases every fingerprint.
 */
@Entity({ name: "device_fingerprints" })
@Unique("device_fingerprints_user_hash_unique", ["userId", "fingerprintHash"])
export class DeviceFingerprint {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(
    () => User,
    (user) => user.deviceFingerprints,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ name: "fingerprint_hash", type: "text" })
  declare fingerprintHash: string;

  @CreateDateColumn({ name: "first_seen_at", type: "timestamptz" })
  declare firstSeenAt: Date;

  @Column({ name: "last_seen_at", type: "timestamptz" })
  declare lastSeenAt: Date;

  @OneToMany(
    () => Session,
    (session) => session.deviceFingerprint,
  )
  declare sessions: Session[];
}
