import path from "node:path";
import { DataSource } from "typeorm";
import { DeviceFingerprint } from "@/auth/entities/device-fingerprint.entity";
import { Identity } from "@/auth/entities/identity.entity";
import { Session } from "@/auth/entities/session.entity";
import { SignInEvent } from "@/auth/entities/sign-in-event.entity";
import { User } from "@/auth/entities/user.entity";
import { Category } from "@/cashflow/entities/category.entity";
import { Tag } from "@/cashflow/entities/tag.entity";
import { Transaction } from "@/cashflow/entities/transaction.entity";
import { TransactionTag } from "@/cashflow/entities/transaction-tag.entity";
import { FxCoverage } from "@/fx/entities/fx-coverage.entity";
import { FxRate } from "@/fx/entities/fx-rate.entity";
import { UserSettings } from "@/users/entities/user-settings.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "true",
  entities: [
    User,
    Identity,
    Session,
    SignInEvent,
    DeviceFingerprint,
    UserSettings,
    Transaction,
    Category,
    Tag,
    TransactionTag,
    FxRate,
    FxCoverage,
  ],
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
  migrationsTableName: "migrations",
});
