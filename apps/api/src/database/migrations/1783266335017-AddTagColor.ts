import { MigrationInterface, QueryRunner } from "typeorm";
import { assignColor } from "../../cashflow/tag-colors";

/**
 * Frozen key list used by the CHECK constraint. Duplicated intentionally
 * (rather than imported from `../../cashflow/tag-colors`) so a future
 * palette rotation cannot silently drift the CHECK away from the row values
 * that were persisted at the time of this migration. A repo-invariant test
 * asserts equality with the runtime `PALETTE_KEYS`; a mismatch means the
 * next migration must ship the rotation.
 */
export const TAG_COLOR_CHECK_KEYS = [
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "slate",
  "orange",
  "lime",
  "cyan",
  "pink",
] as const;

const CHECK_LIST = TAG_COLOR_CHECK_KEYS.map((k) => `'${k}'`).join(", ");

export class AddTagColor1783266335017 implements MigrationInterface {
  name = "AddTagColor1783266335017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Staged NOT NULL add against a populated table: add nullable → backfill
    // → SET NOT NULL → CHECK. Guarded so a partially-crashed retry succeeds.
    await queryRunner.query(
      `ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "color" text`,
    );

    // Backfill by the same rule as `TagsService.create` / `resolveOrCreateByName`.
    const missing: { id: string; name: string }[] = await queryRunner.query(
      `SELECT "id", "name" FROM "tags" WHERE "color" IS NULL`,
    );
    for (const row of missing) {
      await queryRunner.query(
        `UPDATE "tags" SET "color" = $1 WHERE "id" = $2`,
        [assignColor(row.name), row.id],
      );
    }

    // Guard: never fire SET NOT NULL against remaining NULLs.
    const rows: { count: string }[] = await queryRunner.query(
      `SELECT COUNT(*)::text AS "count" FROM "tags" WHERE "color" IS NULL`,
    );
    const remaining = Number(rows[0]?.count ?? 0);
    if (remaining > 0) {
      throw new Error(
        `AddTagColor: ${remaining} tag row(s) still have color IS NULL after backfill`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "tags" ALTER COLUMN "color" SET NOT NULL`,
    );

    // ADD CONSTRAINT is not itself idempotent — wrap so a retry after a
    // successful first CHECK does not error on duplicate_object.
    await queryRunner.query(`DO $$
      BEGIN
        ALTER TABLE "tags" ADD CONSTRAINT "tags_color_valid"
          CHECK ("color" IN (${CHECK_LIST}));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Destructive-by-design (R-06): user-picked colors are lost on rollback.
    // Reapplying up() rehashes every row via assignColor, so tags default
    // back to their auto-assigned key. Operator runbook for any rollback is
    // snapshot-first.
    await queryRunner.query(
      `ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_color_valid"`,
    );
    await queryRunner.query(`ALTER TABLE "tags" DROP COLUMN IF EXISTS "color"`);
  }
}
