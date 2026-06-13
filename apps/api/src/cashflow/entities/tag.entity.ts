import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";

/**
 * User-scoped, flat tag. Implicit creation by name during transaction capture
 * is the dominant path; the explicit `/tags` endpoint serves the management
 * UI. Deleting a tag detaches it from every transaction via the join-table
 * cascade and never removes the transaction itself.
 */
@Entity({ name: "tags" })
@Unique("tags_user_name_uq", ["userId", "name"])
export class Tag {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ type: "text" })
  declare name: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;
}
