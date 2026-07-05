import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { FxLookupService } from "@/fx/services/fx-lookup.service";
import { UserSettingsService } from "@/users/services/user-settings.service";
import { Transaction } from "../entities/transaction.entity";
import { aggregate, enumerateMonths, type MonthBucket } from "./aggregations";
import { currentMonth, monthRangeBounds } from "./month-window";
import { convertRows } from "./summary.service";

export interface TrendQuery {
  from?: string;
  to?: string;
}

export interface TrendResponse {
  from: string;
  to: string;
  baseCurrency: string;
  points: MonthBucket[];
  excludedUnconvertibleCount: number;
}

@Injectable()
export class TrendService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    private readonly fxLookup: FxLookupService,
    private readonly userSettings: UserSettingsService,
  ) {}

  async getForUser(userId: string, query: TrendQuery): Promise<TrendResponse> {
    const { from, to } = await this.resolveWindow(userId, query);
    const { firstDay, lastDay } = monthRangeBounds(from, to);
    const baseCurrency = await this.userSettings.getBaseCurrency(userId);

    const rows = await this.transactions.find({
      where: { userId, date: Between(firstDay, lastDay) },
      select: {
        id: true,
        date: true,
        amount: true,
        currency: true,
        kind: true,
      },
    });

    const convertible = rows.map((row) => ({
      id: row.id,
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      kind: row.kind,
      tagIds: [] as string[],
    }));
    const converted = await convertRows(convertible, baseCurrency, this.fxLookup);
    const result = aggregate(converted, new Map());
    const bucketByMonth = new Map(
      result.byMonth.map((bucket) => [bucket.month, bucket]),
    );
    const points = enumerateMonths(from, to).map(
      (month): MonthBucket =>
        bucketByMonth.get(month) ?? {
          month,
          income: "0.00",
          expense: "0.00",
          net: "0.00",
        },
    );

    return {
      from,
      to,
      baseCurrency,
      points,
      excludedUnconvertibleCount: result.excludedUnconvertibleCount,
    };
  }

  /**
   * When the caller supplies neither bound, anchor `from` on the user's earliest
   * transaction so the window doesn't show empty months that pre-date their
   * usage. The user with no transactions yet gets a single current-month point.
   */
  private async resolveWindow(
    userId: string,
    query: TrendQuery,
  ): Promise<{ from: string; to: string }> {
    const now = currentMonth(new Date());
    if (query.from && query.to) {
      return { from: query.from, to: query.to };
    }
    const earliest = await this.earliestTransactionMonth(userId);
    return {
      from: query.from ?? earliest ?? now,
      to: query.to ?? now,
    };
  }

  private async earliestTransactionMonth(
    userId: string,
  ): Promise<string | null> {
    const row = await this.transactions
      .createQueryBuilder("t")
      .select("MIN(t.date)", "min")
      .where("t.user_id = :userId", { userId })
      .getRawOne<{ min: string | Date | null }>();
    if (!row?.min) return null;
    if (row.min instanceof Date) {
      const year = row.min.getUTCFullYear();
      const month = row.min.getUTCMonth() + 1;
      return `${year}-${String(month).padStart(2, "0")}`;
    }
    return row.min.slice(0, 7);
  }
}
