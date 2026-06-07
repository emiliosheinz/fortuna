import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFxCoverage1780857604151 implements MigrationInterface {
  name = "AddFxCoverage1780857604151";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fx_coverage" ("id" smallint NOT NULL, "last_covered_date" date NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a4f90361e1abd46eb3b1e7f2991" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fx_coverage"`);
  }
}
