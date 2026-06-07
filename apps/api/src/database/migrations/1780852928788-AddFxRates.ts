import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFxRates1780852928788 implements MigrationInterface {
  name = "AddFxRates1780852928788";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fx_rates" ("rate_date" date NOT NULL, "base_currency" character(3) NOT NULL, "quote_currency" character(3) NOT NULL, "rate" numeric(18,6) NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7f4b867609e1d9745ae05af8fd9" PRIMARY KEY ("rate_date", "base_currency", "quote_currency"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "fx_rates_quote_date_idx" ON "fx_rates" ("quote_currency", "rate_date") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."fx_rates_quote_date_idx"`);
    await queryRunner.query(`DROP TABLE "fx_rates"`);
  }
}
