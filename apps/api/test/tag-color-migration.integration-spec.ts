import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { assignColor } from "@/cashflow/tag-colors";
import { AppDataSource } from "@/database/connection";

/**
 * Targeted proof for TCOL-04:
 *   - `up()` backfills every pre-existing tag row via `assignColor(name)`
 *   - the CHECK constraint rejects unknown palette keys
 *   - `down()` removes the column
 * The main `cashflow.integration-spec.ts` bootstrap migrates against an empty
 * `tags` table, so it never exercises the backfill loop. This spec seeds the
 * pre-migration state directly.
 */
describe("AddTagColor migration", () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase("fortuna_test")
      .withUsername("fortuna")
      .withPassword("fortuna")
      .start();

    dataSource = new DataSource({
      ...AppDataSource.options,
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      ssl: false,
    } as ConstructorParameters<typeof DataSource>[0]);
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  async function seedUser(): Promise<string> {
    const [{ id }]: { id: string }[] = await dataSource.query(
      `INSERT INTO "users" ("email", "name", "avatar_url")
       VALUES ('t@example.com', 'T', NULL) RETURNING "id"`,
    );
    return id;
  }

  it("backfills every pre-existing tag row via assignColor(name), then rolls the column back on down()", async () => {
    // Roll back to the pre-AddTagColor schema so the fresh `up()` runs the
    // backfill loop over the seeded rows.
    await dataSource.undoLastMigration();

    const columnBefore: { column_name: string }[] = await dataSource.query(
      `SELECT "column_name" FROM information_schema.columns
       WHERE table_name = 'tags' AND column_name = 'color'`,
    );
    expect(columnBefore).toHaveLength(0);

    const userId = await seedUser();
    const names = ["groceries", "rent", "travel", "food", "transport"];
    for (const name of names) {
      await dataSource.query(
        `INSERT INTO "tags" ("user_id", "name") VALUES ($1, $2)`,
        [userId, name],
      );
    }

    // Fresh `up()` runs — backfill loop must fire.
    await dataSource.runMigrations();

    const rows: { name: string; color: string }[] = await dataSource.query(
      `SELECT "name", "color" FROM "tags" ORDER BY "name"`,
    );
    for (const row of rows) {
      expect(row.color).toBe(assignColor(row.name));
    }

    const nulls: { count: string }[] = await dataSource.query(
      `SELECT COUNT(*)::text AS "count" FROM "tags" WHERE "color" IS NULL`,
    );
    expect(Number(nulls[0].count)).toBe(0);

    // CHECK constraint rejects an unknown palette key.
    await expect(
      dataSource.query(
        `INSERT INTO "tags" ("user_id", "name", "color") VALUES ($1, 'bogus-tag', 'bogus')`,
        [userId],
      ),
    ).rejects.toThrow(/tags_color_valid/);

    // `down()` removes the column.
    await dataSource.undoLastMigration();
    const columnAfter: { column_name: string }[] = await dataSource.query(
      `SELECT "column_name" FROM information_schema.columns
       WHERE table_name = 'tags' AND column_name = 'color'`,
    );
    expect(columnAfter).toHaveLength(0);
  });
});
