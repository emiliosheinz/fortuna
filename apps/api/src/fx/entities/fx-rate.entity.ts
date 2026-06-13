import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * EUR-anchored daily FX rate sourced from frankfurter.app. The PK encodes
 * the natural shape of the source ("on this day, one unit of base buys this
 * much of quote") and the secondary index `(quote_currency, rate_date DESC)`
 * serves the nearest-prior fallback used at read time.
 */
@Entity({ name: "fx_rates" })
@Index("fx_rates_quote_date_idx", ["quoteCurrency", "rateDate"])
export class FxRate {
  @PrimaryColumn({ name: "rate_date", type: "date" })
  declare rateDate: string;

  @PrimaryColumn({ name: "base_currency", type: "char", length: 3 })
  declare baseCurrency: string;

  @PrimaryColumn({ name: "quote_currency", type: "char", length: 3 })
  declare quoteCurrency: string;

  @Column({ type: "numeric", precision: 18, scale: 6 })
  declare rate: string;

  @Column({ name: "fetched_at", type: "timestamptz" })
  declare fetchedAt: Date;
}
