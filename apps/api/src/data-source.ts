import path from "node:path";
import { DataSource } from "typeorm";

try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // .env is optional; in Docker and CI env vars are injected directly
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
