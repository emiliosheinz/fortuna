import path from "node:path";
import { Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DeviceFingerprint } from "./auth/entities/device-fingerprint.entity";
import { Identity } from "./auth/entities/identity.entity";
import { Session } from "./auth/entities/session.entity";
import { SignInEvent } from "./auth/entities/sign-in-event.entity";
import { User } from "./auth/entities/user.entity";
import { CashflowModule } from "./cashflow/cashflow.module";
import { Transaction } from "./cashflow/entities/transaction.entity";
import { MetricsModule } from "./metrics/metrics.module";
import { UserSettings } from "./users/entities/user-settings.entity";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
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
        ],
        migrations: [
          path.join(__dirname, "database", "migrations", "*.{ts,js}"),
        ],
        migrationsTableName: "migrations",
        synchronize: false,
      }),
    }),
    ScheduleModule.forRoot(),
    MetricsModule,
    AuthModule,
    UsersModule,
    CashflowModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
