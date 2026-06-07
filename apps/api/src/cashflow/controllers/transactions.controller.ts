import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateTransactionDto } from "../dto/update-transaction.dto";
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

  @UseGuards(SessionGuard)
  @Get(":id")
  async getOne(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<{ transaction: TransactionResponse }> {
    const principal = requirePrincipal(req);
    const transaction = await this.transactions.getForUser(
      principal.userId,
      id,
    );
    return { transaction };
  }

  @UseGuards(SessionGuard)
  @Patch(":id")
  async update(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<{ transaction: TransactionResponse }> {
    const principal = requirePrincipal(req);
    const transaction = await this.transactions.updateForUser(
      principal.userId,
      id,
      body,
    );
    return { transaction };
  }

  @UseGuards(SessionGuard)
  @Delete(":id")
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const principal = requirePrincipal(req);
    await this.transactions.deleteForUser(principal.userId, id);
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
