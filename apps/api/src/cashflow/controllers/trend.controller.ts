import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { TrendQueryDto } from "../dto/trend-query.dto";
import { TrendResponse, TrendService } from "../services/trend.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("trend")
export class TrendController {
  constructor(private readonly trend: TrendService) {}

  @UseGuards(SessionGuard)
  @Get()
  async get(
    @Req() req: AuthedRequest,
    @Query() query: TrendQueryDto,
  ): Promise<TrendResponse> {
    if (!req.principal) {
      throw new UnauthorizedException();
    }
    return this.trend.getForUser(req.principal.userId, {
      from: query.from,
      to: query.to,
    });
  }
}
