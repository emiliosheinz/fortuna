import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { FxLookupService } from "@/fx/services/fx-lookup.service";
import { UserSettingsService } from "@/users/services/user-settings.service";
import { Transaction } from "../entities/transaction.entity";
import { aggregate, enumerateMonths, type MonthBucket } from "./aggregations";
import { defaultTrendWindow, monthRangeBounds } from "./month-window";
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
    const { from, to } = resolveWindow(query);
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
        categoryId: true,
      },
    });

    const converted = await convertRows(rows, baseCurrency, this.fxLookup);
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
}

function resolveWindow(query: TrendQuery): { from: string; to: string } {
  if (query.from && query.to) {
    return { from: query.from, to: query.to };
  }
  const fallback = defaultTrendWindow(new Date());
  return {
    from: query.from ?? fallback.from,
    to: query.to ?? fallback.to,
  };
}
