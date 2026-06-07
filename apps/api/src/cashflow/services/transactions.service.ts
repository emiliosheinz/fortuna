import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { FxLookupService } from "@/fx/services/fx-lookup.service";
import { UserSettingsService } from "@/users/services/user-settings.service";
import type { CreateTransactionDto } from "../dto/create-transaction.dto";
import type { UpdateTransactionDto } from "../dto/update-transaction.dto";
import { Category } from "../entities/category.entity";
import { Transaction } from "../entities/transaction.entity";
import { TransactionTag } from "../entities/transaction-tag.entity";
import { decodeCursor, encodeCursor } from "./cursor";
import { TagsService } from "./tags.service";
import {
  type TransactionResponse,
  transactionToResponse,
} from "./transaction-response";

export type { TransactionResponse } from "./transaction-response";

export interface ListTransactionsResult {
  items: TransactionResponse[];
  nextCursor: string | null;
}

export interface ListTransactionsOptions {
  limit: number;
  cursor?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  tagId?: string;
  kind?: "income" | "expense";
  q?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tags: TagsService,
    private readonly fxLookup: FxLookupService,
    private readonly userSettings: UserSettingsService,
  ) {}

  async createForUser(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertCategoryOwned(userId, dto.categoryId, manager);

      const transactionRepo = manager.getRepository(Transaction);
      const row = await transactionRepo.save(
        transactionRepo.create({
          userId,
          date: dto.date,
          amount: dto.amount,
          currency: dto.currency,
          description: dto.description,
          kind: dto.kind,
          categoryId: dto.categoryId ?? null,
        }),
      );

      const tags = await this.tags.resolveOrCreateByName(
        manager,
        userId,
        dto.tagNames ?? [],
      );
      if (tags.length > 0) {
        const join = manager.getRepository(TransactionTag);
        await join.save(
          tags.map((tag) =>
            join.create({ transactionId: row.id, tagId: tag.id }),
          ),
        );
      }
      return { row, tagIds: tags.map((t) => t.id) };
    });

    const baseCurrency = await this.userSettings.getBaseCurrency(userId);
    return this.enrichForResponse(saved.row, saved.tagIds, baseCurrency);
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
    if (options.from) {
      qb.andWhere("t.date >= :from", { from: options.from });
    }
    if (options.to) {
      qb.andWhere("t.date <= :to", { to: options.to });
    }
    if (options.categoryId) {
      qb.andWhere("t.category_id = :categoryId", {
        categoryId: options.categoryId,
      });
    }
    if (options.kind) {
      qb.andWhere("t.kind = :kind", { kind: options.kind });
    }
    if (options.q) {
      qb.andWhere("t.description ILIKE :q", { q: `%${options.q}%` });
    }
    if (options.tagId) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM "transaction_tags" tt
          WHERE tt.transaction_id = t.id AND tt.tag_id = :tagId
        )`,
        { tagId: options.tagId },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ date: last.date, id: last.id }) : null;

    const tagsByTransaction = await this.loadTagIds(page.map((r) => r.id));
    const baseCurrency = await this.userSettings.getBaseCurrency(userId);
    const items = await Promise.all(
      page.map((row) =>
        this.enrichForResponse(
          row,
          tagsByTransaction.get(row.id) ?? [],
          baseCurrency,
        ),
      ),
    );
    return { items, nextCursor };
  }

  async getForUser(userId: string, id: string): Promise<TransactionResponse> {
    const row = await this.transactions.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException("Transaction not found");
    }
    const tagIds = (await this.loadTagIds([row.id])).get(row.id) ?? [];
    const baseCurrency = await this.userSettings.getBaseCurrency(userId);
    return this.enrichForResponse(row, tagIds, baseCurrency);
  }

  async updateForUser(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const transactionRepo = manager.getRepository(Transaction);
      const row = await transactionRepo.findOne({ where: { id, userId } });
      if (!row) {
        throw new NotFoundException("Transaction not found");
      }

      if (dto.categoryId !== undefined) {
        await this.assertCategoryOwned(userId, dto.categoryId, manager);
        row.categoryId = dto.categoryId;
      }
      if (dto.date !== undefined) row.date = dto.date;
      if (dto.amount !== undefined) row.amount = dto.amount;
      if (dto.currency !== undefined) row.currency = dto.currency;
      if (dto.description !== undefined) row.description = dto.description;
      if (dto.kind !== undefined) row.kind = dto.kind;

      await transactionRepo.save(row);

      let tagIds: string[];
      if (dto.tagNames !== undefined) {
        const resolved = await this.tags.resolveOrCreateByName(
          manager,
          userId,
          dto.tagNames,
        );
        tagIds = resolved.map((t) => t.id);
        await reconcileJoin(manager, row.id, tagIds);
      } else {
        const existing = await this.loadTagIds([row.id], manager);
        tagIds = existing.get(row.id) ?? [];
      }

      const fresh = await transactionRepo.findOne({ where: { id: row.id } });
      if (!fresh) throw new NotFoundException("Transaction not found");
      return { row: fresh, tagIds };
    });

    const baseCurrency = await this.userSettings.getBaseCurrency(userId);
    return this.enrichForResponse(saved.row, saved.tagIds, baseCurrency);
  }

  /** Group tag ids by transaction id for an arbitrary set of transactions. */
  async loadTagIdsByTransaction(
    transactionIds: string[],
  ): Promise<Map<string, string[]>> {
    return this.loadTagIds(transactionIds);
  }

  async deleteForUser(userId: string, id: string): Promise<void> {
    const result = await this.transactions.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException("Transaction not found");
    }
  }

  private async enrichForResponse(
    row: Transaction,
    tagIds: string[],
    baseCurrency: string,
  ): Promise<TransactionResponse> {
    const resolution = await this.fxLookup.resolve({
      date: row.date,
      transactionCurrency: row.currency,
      baseCurrency,
    });
    return transactionToResponse(row, tagIds, baseCurrency, resolution);
  }

  private async assertCategoryOwned(
    userId: string,
    categoryId: string | null | undefined,
    manager = this.dataSource.manager,
  ): Promise<void> {
    if (!categoryId) return;
    const exists = await manager.getRepository(Category).findOne({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException("Unknown category");
    }
  }

  private async loadTagIds(
    transactionIds: string[],
    manager = this.dataSource.manager,
  ): Promise<Map<string, string[]>> {
    const grouped = new Map<string, string[]>();
    if (transactionIds.length === 0) return grouped;
    const rows = await manager.getRepository(TransactionTag).find({
      where: { transactionId: In(transactionIds) },
      select: { transactionId: true, tagId: true },
    });
    for (const row of rows) {
      const list = grouped.get(row.transactionId);
      if (list) {
        list.push(row.tagId);
      } else {
        grouped.set(row.transactionId, [row.tagId]);
      }
    }
    return grouped;
  }
}

async function reconcileJoin(
  manager: import("typeorm").EntityManager,
  transactionId: string,
  desiredTagIds: string[],
): Promise<void> {
  const repo = manager.getRepository(TransactionTag);
  const current = await repo.find({
    where: { transactionId },
    select: { tagId: true },
  });
  const currentIds = new Set(current.map((row) => row.tagId));
  const desiredIds = new Set(desiredTagIds);

  const toAdd = desiredTagIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

  if (toRemove.length > 0) {
    await repo.delete({ transactionId, tagId: In(toRemove) });
  }
  if (toAdd.length > 0) {
    await repo.save(
      toAdd.map((tagId) => repo.create({ transactionId, tagId })),
    );
  }
}
