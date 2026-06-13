import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";

/**
 * User-scoped, flat category taxonomy. One name per user. Deleted categories
 * detach from their linked transactions through the FK `SET NULL` on
 * `transactions.category_id`.
 */
@Entity({ name: "categories" })
@Unique("categories_user_name_uq", ["userId", "name"])
export class Category {
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

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
