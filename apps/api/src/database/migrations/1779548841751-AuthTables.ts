import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthTables1779548841751 implements MigrationInterface {
  name = "AuthTables1779548841751";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "user_agent" text, "ip_at_creation" inet, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_abaa9e068cdd390bc5210f79884" UNIQUE ("token_hash"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sessions_user_active_idx" ON "sessions" ("user_id", "revoked_at", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" citext NOT NULL, "avatar_url" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" text NOT NULL, "provider_subject" text NOT NULL, "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "identities_provider_subject_unique" UNIQUE ("provider", "provider_subject"), CONSTRAINT "PK_7b2f8cccf4ac6a2d7e6e9e8b1f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "identities_user_id_idx" ON "identities" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "identities" ADD CONSTRAINT "FK_88e77c008cfcfa6a87027a99bde" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "identities" DROP CONSTRAINT "FK_88e77c008cfcfa6a87027a99bde"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`,
    );
    await queryRunner.query(`DROP INDEX "public"."identities_user_id_idx"`);
    await queryRunner.query(`DROP TABLE "identities"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."sessions_user_active_idx"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
