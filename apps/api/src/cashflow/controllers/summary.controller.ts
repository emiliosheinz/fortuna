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
import { SummaryQueryDto } from "../dto/summary-query.dto";
import {
  type SummaryResponse,
  SummaryService,
} from "../services/summary.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("summary")
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @UseGuards(SessionGuard)
  @Get()
  async get(
    @Req() req: AuthedRequest,
    @Query() query: SummaryQueryDto,
  ): Promise<SummaryResponse> {
    if (!req.principal) {
      throw new UnauthorizedException();
    }
    return this.summary.getMonthlyForUser(req.principal.userId, query.month);
  }
}
