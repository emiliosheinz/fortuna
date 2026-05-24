import path from "node:path";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { Identity } from "./auth/entities/identity.entity";
import { Session } from "./auth/entities/session.entity";
import { SignInEvent } from "./auth/entities/sign-in-event.entity";
import { User } from "./auth/entities/user.entity";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: "postgres",
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === "true",
        entities: [User, Identity, Session, SignInEvent],
        migrations: [
          path.join(__dirname, "database", "migrations", "*.{ts,js}"),
        ],
        migrationsTableName: "migrations",
        synchronize: false,
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
