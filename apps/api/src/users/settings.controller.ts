import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { SetBaseCurrencyDto } from "./dto/set-base-currency.dto";
import { UserSettingsService } from "./services/user-settings.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

/** Response body for `GET` and `PUT /users/me/base-currency`. */
export interface BaseCurrencyResponse {
  baseCurrency: string;
}

@Controller("users/me")
export class SettingsController {
  constructor(private readonly settings: UserSettingsService) {}

  @UseGuards(SessionGuard)
  @Get("base-currency")
  async getBaseCurrency(
    @Req() req: AuthedRequest,
  ): Promise<BaseCurrencyResponse> {
    const principal = requirePrincipal(req);
    const baseCurrency = await this.settings.getBaseCurrency(principal.userId);
    return { baseCurrency };
  }

  @UseGuards(SessionGuard)
  @Put("base-currency")
  async setBaseCurrency(
    @Req() req: AuthedRequest,
    @Body() body: SetBaseCurrencyDto,
  ): Promise<BaseCurrencyResponse> {
    const principal = requirePrincipal(req);
    const baseCurrency = await this.settings.setBaseCurrency(
      principal.userId,
      body.baseCurrency,
    );
    return { baseCurrency };
  }
}

function requirePrincipal(req: AuthedRequest): {
  userId: string;
  sessionId: string;
} {
  if (!req.principal) {
    throw new UnauthorizedException();
  }
  return req.principal;
}
