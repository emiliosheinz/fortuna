import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCashflowTransactions1780843347049
  implements MigrationInterface
{
  name = "AddCashflowTransactions1780843347049";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "date" date NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" character(3) NOT NULL, "description" text NOT NULL, "kind" character varying(16) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "transactions_user_date_id_idx" ON "transactions" ("user_id", "date", "id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."transactions_user_date_id_idx"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
  }
}
