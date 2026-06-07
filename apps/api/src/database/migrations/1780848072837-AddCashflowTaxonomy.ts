import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCashflowTaxonomy1780848072837 implements MigrationInterface {
  name = "AddCashflowTaxonomy1780848072837";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "categories_user_name_uq" UNIQUE ("user_id", "name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "tags_user_name_uq" UNIQUE ("user_id", "name"), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "transaction_tags" ("transaction_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_5f99821bd8651353d06674e2c4d" PRIMARY KEY ("transaction_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "transaction_tags_tag_transaction_idx" ON "transaction_tags" ("tag_id", "transaction_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "category_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "transactions_user_category_idx" ON "transactions" ("user_id", "category_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_2296b7fe012d95646fa41921c8b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tags" ADD CONSTRAINT "FK_74603743868d1e4f4fc2c0225b6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_tags" ADD CONSTRAINT "FK_6a8b1add6b564b10240a9b930bc" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_tags" ADD CONSTRAINT "FK_319b507343ce97b2873641bfe54" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_tags" DROP CONSTRAINT "FK_319b507343ce97b2873641bfe54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_tags" DROP CONSTRAINT "FK_6a8b1add6b564b10240a9b930bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tags" DROP CONSTRAINT "FK_74603743868d1e4f4fc2c0225b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_2296b7fe012d95646fa41921c8b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."transactions_user_category_idx"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "category_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."transaction_tags_tag_transaction_idx"`,
    );
    await queryRunner.query(`DROP TABLE "transaction_tags"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
