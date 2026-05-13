import { existsSync } from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";

const envPath = path.join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true",
  entities: [],
  migrations: [path.join(__dirname, "migrations", "*.ts")],
  migrationsTableName: "migrations",
});
