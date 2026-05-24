import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeviceFingerprints1779636868662 implements MigrationInterface {
  name = "AddDeviceFingerprints1779636868662";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "device_fingerprints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "fingerprint_hash" text NOT NULL, "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "device_fingerprints_user_hash_unique" UNIQUE ("user_id", "fingerprint_hash"), CONSTRAINT "PK_c75302ebdfe63b01321380e5780" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "device_fingerprint_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_0e908d1fb979f3969668902d37e" FOREIGN KEY ("device_fingerprint_id") REFERENCES "device_fingerprints"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_fingerprints" ADD CONSTRAINT "FK_d3e9a1f3ca3af3eeaab8ca2ed9e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_fingerprints" DROP CONSTRAINT "FK_d3e9a1f3ca3af3eeaab8ca2ed9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_0e908d1fb979f3969668902d37e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP COLUMN "device_fingerprint_id"`,
    );
    await queryRunner.query(`DROP TABLE "device_fingerprints"`);
  }
}
