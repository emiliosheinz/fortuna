import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";

/**
 * Per-user product settings. One row per user (enforced by the unique
 * constraint on `user_id`). Created lazily on first write, so a row with
 * `null` columns is the absence-of-preference signal.
 */
@Entity({ name: "user_settings" })
export class UserSettings {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid", unique: true })
  declare userId: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ name: "base_currency", type: "char", length: 3, nullable: true })
  declare baseCurrency: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
