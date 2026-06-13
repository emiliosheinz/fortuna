import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionGroupId1780956565742 implements MigrationInterface {
  name = "AddTransactionGroupId1780956565742";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD "group_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "transactions_user_group_idx" ON "transactions" ("user_id", "group_id") WHERE "group_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."transactions_user_group_idx"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "group_id"`,
    );
  }
}
