import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { FxLookupService } from "@/fx/services/fx-lookup.service";
import { UserSettingsService } from "@/users/services/user-settings.service";
import { Tag } from "../entities/tag.entity";
import { Transaction } from "../entities/transaction.entity";
import {
  aggregate,
  type ConvertedRow,
  type TagBucket,
  type TagInfo,
} from "./aggregations";
import { monthBounds } from "./month-window";
import { TransactionsService } from "./transactions.service";

export interface SummaryResponse {
  month: string;
  baseCurrency: string;
  income: string;
  expense: string;
  net: string;
  byTag: TagBucket[];
  excludedUnconvertibleCount: number;
}

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>,
    private readonly transactionsService: TransactionsService,
    private readonly fxLookup: FxLookupService,
    private readonly userSettings: UserSettingsService,
  ) {}

  async getMonthlyForUser(
    userId: string,
    month: string,
  ): Promise<SummaryResponse> {
    const { firstDay, lastDay } = monthBounds(month);
    const baseCurrency = await this.userSettings.getBaseCurrency(userId);

    const rows = await this.transactions.find({
      where: {
        userId,
        date: Between(firstDay, lastDay),
      },
      select: {
        id: true,
        date: true,
        amount: true,
        currency: true,
        kind: true,
      },
    });

    const tagIdsByTransaction =
      await this.transactionsService.loadTagIdsByTransaction(
        rows.map((r) => r.id),
      );
    const convertible: ConvertibleRow[] = rows.map((row) => ({
      id: row.id,
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      kind: row.kind,
      tagIds: tagIdsByTransaction.get(row.id) ?? [],
    }));

    const converted = await convertRows(
      convertible,
      baseCurrency,
      this.fxLookup,
    );
    const tagInfoById = await this.loadTagInfo(userId);
    const result = aggregate(converted, tagInfoById);

    return {
      month,
      baseCurrency,
      income: result.totals.income,
      expense: result.totals.expense,
      net: result.totals.net,
      byTag: result.byTag,
      excludedUnconvertibleCount: result.excludedUnconvertibleCount,
    };
  }

  private async loadTagInfo(userId: string): Promise<Map<string, TagInfo>> {
    const rows = await this.tags.find({
      where: { userId },
      select: { id: true, name: true, color: true },
    });
    return new Map(
      rows.map((row) => [row.id, { name: row.name, color: row.color }]),
    );
  }
}

export interface ConvertibleRow {
  id: string;
  date: string;
  amount: string;
  currency: string;
  kind: Transaction["kind"];
  tagIds: string[];
}

export async function convertRows(
  rows: readonly ConvertibleRow[],
  baseCurrency: string,
  fxLookup: FxLookupService,
): Promise<ConvertedRow[]> {
  const cache = new Map<
    string,
    Awaited<ReturnType<FxLookupService["resolve"]>>
  >();
  const out: ConvertedRow[] = [];
  for (const row of rows) {
    const key = `${row.date}|${row.currency}`;
    let resolution = cache.get(key);
    if (!resolution) {
      resolution = await fxLookup.resolve({
        date: row.date,
        transactionCurrency: row.currency,
        baseCurrency,
      });
      cache.set(key, resolution);
    }
    const baseAmount = fxLookup.convertAmount(row.amount, resolution);
    out.push({
      id: row.id,
      date: row.date,
      kind: row.kind,
      tagIds: row.tagIds,
      baseAmount,
      unconvertible: resolution.unconvertible,
    });
  }
  return out;
}
