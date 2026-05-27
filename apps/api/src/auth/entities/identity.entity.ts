import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Link between a Fortuna {@link User} and an external identity provider.
 *
 * Designed for future providers (apple, password, etc.). The unique
 * `(provider, providerSubject)` index is the canonical lookup key when
 * upserting a user from an IdP sign-in.
 */
@Entity({ name: "identities" })
@Unique("identities_provider_subject_unique", ["provider", "providerSubject"])
export class Identity {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Index("identities_user_id_idx")
  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(
    () => User,
    (user) => user.identities,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ type: "text" })
  declare provider: string;

  @Column({ name: "provider_subject", type: "text" })
  declare providerSubject: string;

  @CreateDateColumn({ name: "linked_at", type: "timestamptz" })
  declare linkedAt: Date;
}
