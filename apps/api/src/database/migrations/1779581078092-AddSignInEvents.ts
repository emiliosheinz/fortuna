import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSignInEvents1779581078092 implements MigrationInterface {
  name = "AddSignInEvents1779581078092";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sign_in_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "correlation_id" uuid NOT NULL, "outcome" text NOT NULL, "ip" inet, "ua_hash" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_73586f99727fd78be086b21bf8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sign_in_events_created_idx" ON "sign_in_events" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "sign_in_events_user_created_idx" ON "sign_in_events" ("user_id", "created_at" DESC) `,
    );
    await queryRunner.query(
      `ALTER TABLE "sign_in_events" ADD CONSTRAINT "FK_0705c16be2e1f1005c418d3efec" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sign_in_events" DROP CONSTRAINT "FK_0705c16be2e1f1005c418d3efec"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."sign_in_events_user_created_idx"`,
    );
    await queryRunner.query(`DROP INDEX "public"."sign_in_events_created_idx"`);
    await queryRunner.query(`DROP TABLE "sign_in_events"`);
  }
}
