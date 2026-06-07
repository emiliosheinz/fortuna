import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FxLookupService } from "@/fx/services/fx-lookup.service";
import { UserSettingsService } from "@/users/services/user-settings.service";
import { Category } from "../entities/category.entity";
import { Tag } from "../entities/tag.entity";
import { Transaction } from "../entities/transaction.entity";
import {
  aggregate,
  type CategoryBucket,
  type ConvertedRow,
  type MonthBucket,
} from "./aggregations";
import { monthRangeBounds } from "./month-window";
import {
  type TransactionResponse,
  transactionToResponse,
} from "./transaction-response";
import { TransactionsService } from "./transactions.service";

export interface TagDrillDownQuery {
  from?: string;
  to?: string;
}

export interface TagDrillDownResponse {
  tag: { id: string; name: string };
  baseCurrency: string;
  from: string | null;
  to: string | null;
  transactions: TransactionResponse[];
  byCategory: CategoryBucket[];
  byMonth: MonthBucket[];
  excludedUnconvertibleCount: number;
}

@Injectable()
export class TagDrillDownService {
  constructor(
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly fxLookup: FxLookupService,
    private readonly userSettings: UserSettingsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getForUser(
    userId: string,
    tagId: string,
    query: TagDrillDownQuery,
  ): Promise<TagDrillDownResponse> {
    const tag = await this.tags.findOne({
      where: { id: tagId, userId },
      select: { id: true, name: true },
    });
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    const window = resolveWindow(query);
    const baseCurrency = await this.userSettings.getBaseCurrency(userId);
    const rows = await this.loadTaggedTransactions(userId, tagId, window);

    const tagIdsByTransaction =
      await this.transactionsService.loadTagIdsByTransaction(
        rows.map((r) => r.id),
      );
    const categoryNameById = await this.loadCategoryNames(userId);

    const transactions: TransactionResponse[] = [];
    const converted: ConvertedRow[] = [];
    for (const row of rows) {
      const resolution = await this.fxLookup.resolve({
        date: row.date,
        transactionCurrency: row.currency,
        baseCurrency,
      });
      const baseAmount = this.fxLookup.convertAmount(row.amount, resolution);
      transactions.push(
        transactionToResponse(
          row,
          tagIdsByTransaction.get(row.id) ?? [],
          baseCurrency,
          resolution,
        ),
      );
      converted.push({
        id: row.id,
        date: row.date,
        kind: row.kind,
        categoryId: row.categoryId,
        baseAmount,
        unconvertible: resolution.unconvertible,
      });
    }

    const result = aggregate(converted, categoryNameById);
    return {
      tag,
      baseCurrency,
      from: window?.from ?? null,
      to: window?.to ?? null,
      transactions,
      byCategory: result.byCategory,
      byMonth: result.byMonth,
      excludedUnconvertibleCount: result.excludedUnconvertibleCount,
    };
  }

  private async loadTaggedTransactions(
    userId: string,
    tagId: string,
    window: { from: string; to: string } | null,
  ): Promise<Transaction[]> {
    const qb = this.transactions
      .createQueryBuilder("t")
      .innerJoin("transaction_tags", "tt", "tt.transaction_id = t.id")
      .where("t.user_id = :userId", { userId })
      .andWhere("tt.tag_id = :tagId", { tagId })
      .orderBy("t.date", "DESC")
      .addOrderBy("t.id", "DESC");
    if (window) {
      const { firstDay, lastDay } = monthRangeBounds(window.from, window.to);
      qb.andWhere("t.date BETWEEN :firstDay AND :lastDay", {
        firstDay,
        lastDay,
      });
    }
    return qb.getMany();
  }

  private async loadCategoryNames(
    userId: string,
  ): Promise<Map<string, string>> {
    const rows = await this.categories.find({
      where: { userId },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}

function resolveWindow(
  query: TagDrillDownQuery,
): { from: string; to: string } | null {
  const { from, to } = query;
  if (!from && !to) return null;
  if (from && to) return { from, to };
  const anchor = from ?? to;
  if (!anchor) return null;
  return { from: anchor, to: anchor };
}
