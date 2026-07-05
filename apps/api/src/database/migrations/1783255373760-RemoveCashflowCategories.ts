import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCashflowCategories1783255373760
  implements MigrationInterface
{
  name = "RemoveCashflowCategories1783255373760";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Data step — every category becomes a tag for its owning user; existing
    // same-name tag absorbs the copy via the unique constraint.
    await queryRunner.query(
      `INSERT INTO "tags" ("user_id", "name")
       SELECT "user_id", "name" FROM "categories"
       ON CONFLICT ("user_id", "name") DO NOTHING`,
    );
    // Every categorised transaction gains a link to the resolved tag.
    await queryRunner.query(
      `INSERT INTO "transaction_tags" ("transaction_id", "tag_id")
       SELECT t."id", tag."id"
       FROM "transactions" t
       JOIN "categories" c ON c."id" = t."category_id"
       JOIN "tags" tag ON tag."user_id" = c."user_id" AND tag."name" = c."name"
       ON CONFLICT ("transaction_id", "tag_id") DO NOTHING`,
    );

    // Schema DROPs — FK-before-table order (AD-20 rule #2).
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."transactions_user_category_idx"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_2296b7fe012d95646fa41921c8b"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Schema-only rollback — no category rows or category_id values are
    // reconstructed from tags (AD-09). IF NOT EXISTS guards make the
    // recreate DDL retriable under a partial-restore state (AD-20 rule #3).
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "categories_user_name_uq" UNIQUE ("user_id", "name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_2296b7fe012d95646fa41921c8b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "category_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "transactions_user_category_idx" ON "transactions" ("user_id", "category_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
