import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { UserSettings } from "./entities/user-settings.entity";
import { UserSettingsService } from "./services/user-settings.service";
import { SettingsController } from "./settings.controller";
import { UsersController } from "./users.controller";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserSettings])],
  controllers: [UsersController, SettingsController],
  providers: [UserSettingsService],
  exports: [UserSettingsService],
})
export class UsersModule {}
