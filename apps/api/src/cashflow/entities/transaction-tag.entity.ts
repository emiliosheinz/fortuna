import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Tag } from "./tag.entity";
import { Transaction } from "./transaction.entity";

/**
 * Many-to-many link between transactions and tags. Composite PK on
 * `(transaction_id, tag_id)`; both sides cascade on delete so removing a
 * transaction or a tag drops the link without leaving orphans. The
 * `(tag_id, transaction_id)` index is the read path for tag drill-down.
 */
@Entity({ name: "transaction_tags" })
@Index("transaction_tags_tag_transaction_idx", ["tagId", "transactionId"])
export class TransactionTag {
  @PrimaryColumn({ name: "transaction_id", type: "uuid" })
  declare transactionId: string;

  @PrimaryColumn({ name: "tag_id", type: "uuid" })
  declare tagId: string;

  @ManyToOne(() => Transaction, { onDelete: "CASCADE" })
  @JoinColumn({ name: "transaction_id" })
  declare transaction: Transaction;

  @ManyToOne(() => Tag, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tag_id" })
  declare tag: Tag;
}
