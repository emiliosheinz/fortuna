import path from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource, type QueryRunner } from "typeorm";
import { RemoveCashflowCategories1783255373760 } from "@/database/migrations/1783255373760-RemoveCashflowCategories";

const TARGET_MIGRATION_NAME = "RemoveCashflowCategories1783255373760";

interface CountRow {
  count: string;
}

async function seedUser(
  dataSource: DataSource,
  id: string,
  email: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "users" ("id", "name", "email") VALUES ($1, $2, $3)`,
    [id, email.split("@")[0], email],
  );
}

async function seedCategory(
  dataSource: DataSource,
  id: string,
  userId: string,
  name: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "categories" ("id", "user_id", "name") VALUES ($1, $2, $3)`,
    [id, userId, name],
  );
}

async function seedTag(
  dataSource: DataSource,
  id: string,
  userId: string,
  name: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "tags" ("id", "user_id", "name") VALUES ($1, $2, $3)`,
    [id, userId, name],
  );
}

async function seedTransaction(
  dataSource: DataSource,
  id: string,
  userId: string,
  categoryId: string | null,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "transactions"
       ("id", "user_id", "date", "amount", "currency", "description", "kind", "category_id")
     VALUES ($1, $2, '2026-06-01', '100.00', 'USD', 'seed', 'expense', $3)`,
    [id, userId, categoryId],
  );
}

async function seedTransactionTag(
  dataSource: DataSource,
  transactionId: string,
  tagId: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "transaction_tags" ("transaction_id", "tag_id") VALUES ($1, $2)`,
    [transactionId, tagId],
  );
}

async function isTargetApplied(dataSource: DataSource): Promise<boolean> {
  const rows: Array<{ name: string }> = await dataSource.query(
    `SELECT "name" FROM "migrations" WHERE "name" = $1`,
    [TARGET_MIGRATION_NAME],
  );
  return rows.length > 0;
}

async function tableExists(
  dataSource: DataSource,
  table: string,
): Promise<boolean> {
  const rows: Array<{ exists: boolean }> = await dataSource.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS "exists"`,
    [table],
  );
  return rows[0]?.exists === true;
}

async function columnExists(
  dataSource: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows: Array<{ exists: boolean }> = await dataSource.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS "exists"`,
    [table, column],
  );
  return rows[0]?.exists === true;
}

async function indexExists(
  dataSource: DataSource,
  index: string,
): Promise<boolean> {
  const rows: Array<{ exists: boolean }> = await dataSource.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
     ) AS "exists"`,
    [index],
  );
  return rows[0]?.exists === true;
}

describe("RemoveCashflowCategories migration", () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase("fortuna_test")
      .withUsername("fortuna")
      .withPassword("fortuna")
      .start();

    dataSource = new DataSource({
      type: "postgres",
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      entities: [],
      migrations: [
        path.join(__dirname, "..", "src", "database", "migrations", "*.ts"),
      ],
      migrationsTableName: "migrations",
    });

    await dataSource.initialize();
    await dataSource.runMigrations();
    // Rewind past the target so every test starts at pre-migration state.
    await dataSource.undoLastMigration();
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    if (await isTargetApplied(dataSource)) {
      await dataSource.undoLastMigration();
    }
    await dataSource.query(
      `TRUNCATE TABLE "transaction_tags", "tags", "categories", "transactions", "users" RESTART IDENTITY CASCADE`,
    );
  });

  describe("data migration — categories → tags", () => {
    it("materialises a tag row for a category with no same-name tag", async () => {
      const userId = "11111111-1111-1111-1111-111111111111";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
      await seedUser(dataSource, userId, "alice@example.com");
      await seedCategory(dataSource, categoryId, userId, "Food");

      await dataSource.runMigrations();

      const rows: Array<{ user_id: string; name: string }> =
        await dataSource.query(
          `SELECT "user_id", "name" FROM "tags" WHERE "user_id" = $1`,
          [userId],
        );
      expect(rows).toEqual([{ user_id: userId, name: "Food" }]);
    });

    it("merges onto an existing same-name tag without violating the unique constraint", async () => {
      const userId = "22222222-2222-2222-2222-222222222222";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2";
      const tagId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";
      await seedUser(dataSource, userId, "bob@example.com");
      await seedTag(dataSource, tagId, userId, "Food");
      await seedCategory(dataSource, categoryId, userId, "Food");

      await expect(dataSource.runMigrations()).resolves.toBeDefined();

      const rows: Array<{ id: string; user_id: string; name: string }> =
        await dataSource.query(
          `SELECT "id", "user_id", "name" FROM "tags" WHERE "user_id" = $1`,
          [userId],
        );
      expect(rows).toEqual([{ id: tagId, user_id: userId, name: "Food" }]);
    });

    it("links every categorised transaction to the resolved tag", async () => {
      const userId = "33333333-3333-3333-3333-333333333333";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3";
      const transactionId = "cccccccc-cccc-cccc-cccc-cccccccccc03";
      await seedUser(dataSource, userId, "carol@example.com");
      await seedCategory(dataSource, categoryId, userId, "Food");
      await seedTransaction(dataSource, transactionId, userId, categoryId);

      await dataSource.runMigrations();

      const [{ id: resolvedTagId }]: Array<{ id: string }> =
        await dataSource.query(
          `SELECT "id" FROM "tags" WHERE "user_id" = $1 AND "name" = $2`,
          [userId, "Food"],
        );
      const links: Array<{ transaction_id: string; tag_id: string }> =
        await dataSource.query(
          `SELECT "transaction_id", "tag_id" FROM "transaction_tags" WHERE "transaction_id" = $1`,
          [transactionId],
        );
      expect(links).toEqual([
        { transaction_id: transactionId, tag_id: resolvedTagId },
      ]);
    });

    it("absorbs duplicate transaction_tag links via ON CONFLICT DO NOTHING", async () => {
      const userId = "44444444-4444-4444-4444-444444444444";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4";
      const tagId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4";
      const transactionId = "cccccccc-cccc-cccc-cccc-cccccccccc04";
      await seedUser(dataSource, userId, "dan@example.com");
      await seedTag(dataSource, tagId, userId, "Food");
      await seedCategory(dataSource, categoryId, userId, "Food");
      await seedTransaction(dataSource, transactionId, userId, categoryId);
      await seedTransactionTag(dataSource, transactionId, tagId);

      await expect(dataSource.runMigrations()).resolves.toBeDefined();

      const links: Array<{ transaction_id: string; tag_id: string }> =
        await dataSource.query(
          `SELECT "transaction_id", "tag_id" FROM "transaction_tags" WHERE "transaction_id" = $1`,
          [transactionId],
        );
      expect(links).toEqual([{ transaction_id: transactionId, tag_id: tagId }]);
    });

    it("no-ops for a user with zero categories", async () => {
      const userId = "55555555-5555-5555-5555-555555555555";
      const transactionId = "cccccccc-cccc-cccc-cccc-cccccccccc05";
      await seedUser(dataSource, userId, "eve@example.com");
      await seedTransaction(dataSource, transactionId, userId, null);

      await dataSource.runMigrations();

      const tagCount: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "tags" WHERE "user_id" = $1`,
        [userId],
      );
      const linkCount: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "transaction_tags" WHERE "transaction_id" = $1`,
        [transactionId],
      );
      expect(tagCount[0].count).toBe("0");
      expect(linkCount[0].count).toBe("0");
    });

    it("materialises a tag for a category with no transactions", async () => {
      const userId = "66666666-6666-6666-6666-666666666666";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6";
      await seedUser(dataSource, userId, "fran@example.com");
      await seedCategory(dataSource, categoryId, userId, "Food");

      await dataSource.runMigrations();

      const tags: Array<{ user_id: string; name: string }> =
        await dataSource.query(
          `SELECT "user_id", "name" FROM "tags" WHERE "user_id" = $1`,
          [userId],
        );
      const links: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "transaction_tags" tt
         JOIN "tags" tag ON tag."id" = tt."tag_id"
         WHERE tag."user_id" = $1`,
        [userId],
      );
      expect(tags).toEqual([{ user_id: userId, name: "Food" }]);
      expect(links[0].count).toBe("0");
    });

    it("keeps the pre-existing tag row when a category has no transactions and the tag already exists", async () => {
      const userId = "77777777-7777-7777-7777-777777777777";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7";
      const tagId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7";
      await seedUser(dataSource, userId, "gina@example.com");
      await seedTag(dataSource, tagId, userId, "Food");
      await seedCategory(dataSource, categoryId, userId, "Food");

      await dataSource.runMigrations();

      const tags: Array<{ id: string; user_id: string; name: string }> =
        await dataSource.query(
          `SELECT "id", "user_id", "name" FROM "tags" WHERE "user_id" = $1`,
          [userId],
        );
      const links: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "transaction_tags" tt
         JOIN "tags" tag ON tag."id" = tt."tag_id"
         WHERE tag."user_id" = $1`,
        [userId],
      );
      expect(tags).toEqual([{ id: tagId, user_id: userId, name: "Food" }]);
      expect(links[0].count).toBe("0");
    });

    it("copies category names byte-exact, preserving whitespace and case", async () => {
      const userId = "88888888-8888-8888-8888-888888888888";
      await seedUser(dataSource, userId, "hank@example.com");
      await seedCategory(
        dataSource,
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa81",
        userId,
        "  Food ",
      );
      await seedCategory(
        dataSource,
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa82",
        userId,
        "food",
      );
      await seedCategory(
        dataSource,
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa83",
        userId,
        "Food",
      );

      await dataSource.runMigrations();

      const names: Array<{ name: string }> = await dataSource.query(
        `SELECT "name" FROM "tags" WHERE "user_id" = $1 ORDER BY "name"`,
        [userId],
      );
      expect(names.map((row) => row.name).sort()).toEqual(
        ["  Food ", "food", "Food"].sort(),
      );
    });
  });

  describe("schema drop", () => {
    it("leaves no categories artefacts behind after up()", async () => {
      await dataSource.runMigrations();

      expect(await tableExists(dataSource, "categories")).toBe(false);
      expect(
        await columnExists(dataSource, "transactions", "category_id"),
      ).toBe(false);
      expect(
        await indexExists(dataSource, "transactions_user_category_idx"),
      ).toBe(false);
    });

    it("succeeds against a clean database with no category rows", async () => {
      const userId = "99999999-9999-9999-9999-999999999999";
      await seedUser(dataSource, userId, "ivan@example.com");
      await seedTransaction(
        dataSource,
        "cccccccc-cccc-cccc-cccc-cccccccccc09",
        userId,
        null,
      );

      await expect(dataSource.runMigrations()).resolves.toBeDefined();

      expect(await tableExists(dataSource, "categories")).toBe(false);
      expect(
        await columnExists(dataSource, "transactions", "category_id"),
      ).toBe(false);
      expect(
        await indexExists(dataSource, "transactions_user_category_idx"),
      ).toBe(false);
    });
  });

  describe("atomicity", () => {
    it("rolls the pre-migration schema back when the data step raises before the DROPs", async () => {
      const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab";
      const transactionId = "cccccccc-cccc-cccc-cccc-cccccccccc0a";
      await seedUser(dataSource, userId, "jane@example.com");
      await seedCategory(dataSource, categoryId, userId, "Food");
      await seedTransaction(dataSource, transactionId, userId, categoryId);

      const migration = new RemoveCashflowCategories1783255373760();
      const qr: QueryRunner = dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();

      const originalQuery = qr.query.bind(qr);
      (qr as unknown as { query: unknown }).query = async (
        sql: string,
        parameters?: unknown[],
        useStructuredResult?: boolean,
      ) => {
        if (
          typeof sql === "string" &&
          sql.includes(`INSERT INTO "transaction_tags"`)
        ) {
          throw new Error("SIMULATED_FAILURE_IN_DATA_STEP");
        }
        return originalQuery(sql, parameters, useStructuredResult);
      };

      let raised: Error | null = null;
      try {
        await migration.up(qr);
      } catch (error) {
        raised = error as Error;
      } finally {
        await qr.rollbackTransaction();
        await qr.release();
      }

      expect(raised?.message).toBe("SIMULATED_FAILURE_IN_DATA_STEP");
      expect(await tableExists(dataSource, "categories")).toBe(true);
      expect(
        await columnExists(dataSource, "transactions", "category_id"),
      ).toBe(true);
      expect(
        await indexExists(dataSource, "transactions_user_category_idx"),
      ).toBe(true);

      const categories: Array<{ id: string; user_id: string; name: string }> =
        await dataSource.query(
          `SELECT "id", "user_id", "name" FROM "categories" WHERE "user_id" = $1`,
          [userId],
        );
      const transactions: Array<{ id: string; category_id: string | null }> =
        await dataSource.query(
          `SELECT "id", "category_id" FROM "transactions" WHERE "user_id" = $1`,
          [userId],
        );
      expect(categories).toEqual([
        { id: categoryId, user_id: userId, name: "Food" },
      ]);
      expect(transactions).toEqual([
        { id: transactionId, category_id: categoryId },
      ]);
    });
  });

  describe("down()", () => {
    it("recreates the schema empty and does not reconstruct category rows from tags", async () => {
      const userId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
      const categoryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac";
      const transactionId = "cccccccc-cccc-cccc-cccc-cccccccccc0b";
      await seedUser(dataSource, userId, "kate@example.com");
      await seedCategory(dataSource, categoryId, userId, "Food");
      await seedTransaction(dataSource, transactionId, userId, categoryId);

      await dataSource.runMigrations();
      // Sanity: after up() the migrated tag exists.
      const tagsAfterUp: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "tags" WHERE "user_id" = $1`,
        [userId],
      );
      expect(tagsAfterUp[0].count).toBe("1");

      await dataSource.undoLastMigration();

      expect(await tableExists(dataSource, "categories")).toBe(true);
      expect(
        await columnExists(dataSource, "transactions", "category_id"),
      ).toBe(true);
      expect(
        await indexExists(dataSource, "transactions_user_category_idx"),
      ).toBe(true);

      const categoriesCount: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "categories"`,
      );
      expect(categoriesCount[0].count).toBe("0");

      const nonNullCategoryLinks: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "transactions" WHERE "category_id" IS NOT NULL`,
      );
      expect(nonNullCategoryLinks[0].count).toBe("0");

      // Tags survive the rollback — down() is schema-only.
      const tagsAfterDown: CountRow[] = await dataSource.query(
        `SELECT COUNT(*)::text AS count FROM "tags" WHERE "user_id" = $1`,
        [userId],
      );
      expect(tagsAfterDown[0].count).toBe("1");
    });
  });
});
