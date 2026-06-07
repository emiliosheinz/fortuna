import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { CreateTransactionDto } from "../dto/create-transaction.dto";
import { ListTransactionsDto } from "../dto/list-transactions.dto";
import type {
  ListTransactionsResult,
  TransactionResponse,
} from "../services/transactions.service";
import { TransactionsService } from "../services/transactions.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @UseGuards(SessionGuard)
  @Post()
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: CreateTransactionDto,
  ): Promise<{ transaction: TransactionResponse }> {
    const principal = requirePrincipal(req);
    const transaction = await this.transactions.createForUser(
      principal.userId,
      body,
    );
    return { transaction };
  }

  @UseGuards(SessionGuard)
  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query() query: ListTransactionsDto,
  ): Promise<ListTransactionsResult> {
    const principal = requirePrincipal(req);
    try {
      return await this.transactions.listForUser(principal.userId, {
        limit: query.resolvedLimit(),
        cursor: query.cursor,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid cursor") {
        throw new BadRequestException("Invalid cursor");
      }
      throw err;
    }
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
