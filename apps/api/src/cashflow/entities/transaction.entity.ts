import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";

export type TransactionKind = "income" | "expense";

/**
 * Single-entry transaction owned by a user.
 *
 * The recorded amount lives in the transaction's own currency; the
 * base-currency rollup is computed at read time from `fx_rates` (Phase 3),
 * so no stored base-currency amount is kept on this row. `category_id`
 * and `group_id` land in later phases.
 */
@Entity({ name: "transactions" })
@Index("transactions_user_date_id_idx", ["userId", "date", "id"])
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ type: "date" })
  declare date: string;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  declare amount: string;

  @Column({ type: "char", length: 3 })
  declare currency: string;

  @Column({ type: "text" })
  declare description: string;

  @Column({ type: "varchar", length: 16 })
  declare kind: TransactionKind;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
