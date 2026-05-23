import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Identity } from "./identity.entity";
import { Session } from "./session.entity";

/**
 * Canonical Fortuna user.
 *
 * Profile fields mirror the Google ID token claims (name, email, avatarUrl).
 * Identity providers are linked via the {@link Identity} table — this row is
 * never matched by email when upserting from an IdP, only by
 * `(provider, providerSubject)`.
 */
@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ type: "text" })
  declare name: string;

  @Column({ type: "citext", unique: true })
  declare email: string;

  @Column({ name: "avatar_url", type: "text", nullable: true })
  declare avatarUrl: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;

  @OneToMany(
    () => Identity,
    (identity) => identity.user,
  )
  declare identities: Identity[];

  @OneToMany(
    () => Session,
    (session) => session.user,
  )
  declare sessions: Session[];
}
