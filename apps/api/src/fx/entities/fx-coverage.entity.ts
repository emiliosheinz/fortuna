import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Singleton row tracking the last date the self-healing FX catch-up job has
 * attempted to cover. The next run fetches `(lastCoveredDate, today]` from
 * the upstream and advances the watermark to today. A single row keyed on
 * the constant `id = 1` keeps the read path index-free.
 */
@Entity({ name: "fx_coverage" })
export class FxCoverage {
  @PrimaryColumn({ type: "smallint" })
  declare id: number;

  @Column({ name: "last_covered_date", type: "date" })
  declare lastCoveredDate: string;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
