import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { FxLookupService } from "@/fx/services/fx-lookup.service";
import { UserSettingsService } from "@/users/services/user-settings.service";
import { Category } from "../entities/category.entity";
import { Transaction } from "../entities/transaction.entity";
import {
  aggregate,
  type CategoryBucket,
  type ConvertedRow,
} from "./aggregations";
import { monthBounds } from "./month-window";

export interface SummaryResponse {
  month: string;
  baseCurrency: string;
  income: string;
  expense: string;
  net: string;
  byCategory: CategoryBucket[];
  excludedUnconvertibleCount: number;
}

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
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
        categoryId: true,
      },
    });

    const converted = await convertRows(rows, baseCurrency, this.fxLookup);
    const categoryNameById = await this.loadCategoryNames(userId);
    const result = aggregate(converted, categoryNameById);

    return {
      month,
      baseCurrency,
      income: result.totals.income,
      expense: result.totals.expense,
      net: result.totals.net,
      byCategory: result.byCategory,
      excludedUnconvertibleCount: result.excludedUnconvertibleCount,
    };
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

export interface ConvertibleRow {
  id: string;
  date: string;
  amount: string;
  currency: string;
  kind: Transaction["kind"];
  categoryId: string | null;
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
      categoryId: row.categoryId,
      baseAmount,
      unconvertible: resolution.unconvertible,
    });
  }
  return out;
}
