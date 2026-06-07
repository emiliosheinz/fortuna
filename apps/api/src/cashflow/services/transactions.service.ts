import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateTransactionDto } from "../dto/create-transaction.dto";
import { Transaction } from "../entities/transaction.entity";
import { decodeCursor, encodeCursor } from "./cursor";

export interface TransactionResponse {
  id: string;
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: Transaction["kind"];
  createdAt: string;
  updatedAt: string;
}

export interface ListTransactionsResult {
  items: TransactionResponse[];
  nextCursor: string | null;
}

export interface ListTransactionsOptions {
  limit: number;
  cursor?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
  ) {}

  async createForUser(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    const saved = await this.transactions.save(
      this.transactions.create({
        userId,
        date: dto.date,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        kind: dto.kind,
      }),
    );

    return toResponse(saved);
  }

  async listForUser(
    userId: string,
    options: ListTransactionsOptions,
  ): Promise<ListTransactionsResult> {
    const qb = this.transactions
      .createQueryBuilder("t")
      .where("t.user_id = :userId", { userId })
      .orderBy("t.date", "DESC")
      .addOrderBy("t.id", "DESC")
      .limit(options.limit + 1);

    if (options.cursor) {
      const { date, id } = decodeCursor(options.cursor);
      qb.andWhere("(t.date, t.id) < (:cursorDate, :cursorId)", {
        cursorDate: date,
        cursorId: id,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ date: last.date, id: last.id }) : null;

    return { items: page.map(toResponse), nextCursor };
  }
}

function toResponse(row: Transaction): TransactionResponse {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
