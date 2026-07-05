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
 * base-currency rollup is computed at read time from `fx_rates` (Phase 3).
 * `group_id` links sibling rows produced together at capture (installments
 * today, splits or refund-pairs later); per-row position and group size are
 * derived at read time from window functions over the siblings.
 */
@Entity({ name: "transactions" })
@Index("transactions_user_date_id_idx", ["userId", "date", "id"])
@Index("transactions_user_group_idx", ["userId", "groupId"], {
  where: '"group_id" IS NOT NULL',
})
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

  @Column({ name: "group_id", type: "uuid", nullable: true })
  declare groupId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
