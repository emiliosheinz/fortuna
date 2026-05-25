import path from "node:path";
import { DataSource } from "typeorm";
import { DeviceFingerprint } from "@/auth/entities/device-fingerprint.entity";
import { Identity } from "@/auth/entities/identity.entity";
import { Session } from "@/auth/entities/session.entity";
import { SignInEvent } from "@/auth/entities/sign-in-event.entity";
import { User } from "@/auth/entities/user.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "true",
  entities: [User, Identity, Session, SignInEvent, DeviceFingerprint],
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
  migrationsTableName: "migrations",
});
