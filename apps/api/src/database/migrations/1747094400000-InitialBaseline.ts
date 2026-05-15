import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialBaseline1747094400000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
