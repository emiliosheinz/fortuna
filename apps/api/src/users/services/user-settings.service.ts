import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserSettings } from "../entities/user-settings.entity";

export const DEFAULT_BASE_CURRENCY = "USD";

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settings: Repository<UserSettings>,
  ) {}

  async getBaseCurrency(userId: string): Promise<string> {
    const row = await this.settings.findOne({
      where: { userId },
      select: { baseCurrency: true },
    });
    return row?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
  }

  async setBaseCurrency(userId: string, baseCurrency: string): Promise<string> {
    await this.settings.upsert(
      { userId, baseCurrency },
      { conflictPaths: ["userId"] },
    );
    return baseCurrency;
  }
}
