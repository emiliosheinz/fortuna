import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MetricsService } from "@/metrics/metrics.service";
import {
  FX_BASE_CURRENCY,
  FX_COVERAGE_START_DATE,
  SUPPORTED_QUOTE_CURRENCIES,
} from "../constants";
import { FxCoverage } from "../entities/fx-coverage.entity";
import { FxRate } from "../entities/fx-rate.entity";
import {
  FrankfurterClient,
  type FrankfurterHistoricalDay,
  type FrankfurterLatestResponse,
} from "./frankfurter-client";

export interface FxFetchRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const FX_FETCH_RETRY_OPTIONS = Symbol("FX_FETCH_RETRY_OPTIONS");
export const FX_FRANKFURTER_CLIENT = Symbol("FX_FRANKFURTER_CLIENT");

const COVERAGE_SINGLETON_ID = 1;

const DEFAULTS: Required<Omit<FxFetchRetryOptions, "sleep">> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
};

export interface CatchUpResult {
  persisted: number;
  from: string;
  to: string;
  noop: boolean;
}

@Injectable()
export class FxFetchService {
  private readonly logger = new Logger(FxFetchService.name);
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly client: FrankfurterClient;

  constructor(
    @InjectRepository(FxRate)
    private readonly fxRates: Repository<FxRate>,
    @InjectRepository(FxCoverage)
    private readonly coverage: Repository<FxCoverage>,
    private readonly metrics: MetricsService,
    @Inject(FX_FRANKFURTER_CLIENT)
    client: FrankfurterClient,
    @Inject(FX_FETCH_RETRY_OPTIONS)
    options: FxFetchRetryOptions,
  ) {
    this.client = client;
    this.maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULTS.baseDelayMs;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * The job that runs in production. Fills any gap between the coverage
   * watermark and today by issuing one historical fetch over the open
   * range, persisting whatever Frankfurter returns, then advancing the
   * watermark. Idempotent: a second call on the same day finds the
   * watermark already at today and no-ops.
   */
  async fetchAndPersistCatchUp(today = todayIsoUtc()): Promise<CatchUpResult> {
    const watermark = await this.readCoverage();
    const start = watermark ? nextDayIso(watermark) : FX_COVERAGE_START_DATE;
    if (start > today) {
      return { persisted: 0, from: start, to: today, noop: true };
    }
    const persisted = await this.fetchAndPersistRange(start, today);
    await this.writeCoverage(today);
    return { persisted, from: start, to: today, noop: false };
  }

  private async fetchAndPersistRange(
    from: string,
    to: string,
  ): Promise<number> {
    const result = await this.runWithRetry(() =>
      this.client.fetchHistoricalEurAnchored({ from, to }),
    );
    let written = 0;
    for (const day of result) {
      written += await this.persistDay({
        rateDate: day.rateDate,
        baseCurrency: FX_BASE_CURRENCY,
        rates: day.rates,
      });
    }
    await this.refreshFreshnessGauge();
    return written;
  }

  private async runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const value = await operation();
        this.metrics.recordFxFetchAttempt("success");
        this.metrics.setFxFetchLastSuccessTimestampSeconds(
          Math.floor(Date.now() / 1000),
        );
        return value;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxAttempts) {
          this.metrics.recordFxFetchAttempt("retry");
          await this.sleep(this.computeBackoffDelay(attempt));
        } else {
          this.metrics.recordFxFetchAttempt("failure");
        }
      }
    }
    this.logger.error("FX fetch failed after all retries", {
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    throw lastError instanceof Error ? lastError : new Error("FX fetch failed");
  }

  private computeBackoffDelay(attempt: number): number {
    const delay = this.baseDelayMs * 2 ** (attempt - 1);
    return Math.min(delay, this.maxDelayMs);
  }

  private async persistDay(day: FrankfurterLatestResponse): Promise<number> {
    const fetchedAt = new Date();
    const values = Object.entries(day.rates)
      .filter(([quote]) => SUPPORTED_QUOTE_CURRENCIES.includes(quote))
      .map(([quote, rate]) => ({
        rateDate: day.rateDate,
        baseCurrency: day.baseCurrency,
        quoteCurrency: quote,
        rate,
        fetchedAt,
      }));
    if (values.length === 0) return 0;
    await this.fxRates.upsert(values, {
      conflictPaths: ["rateDate", "baseCurrency", "quoteCurrency"],
    });
    return values.length;
  }

  private async readCoverage(): Promise<string | null> {
    const row = await this.coverage.findOne({
      where: { id: COVERAGE_SINGLETON_ID },
      select: { lastCoveredDate: true },
    });
    if (!row) return null;
    return normaliseDate(row.lastCoveredDate);
  }

  private async writeCoverage(date: string): Promise<void> {
    await this.coverage.upsert(
      { id: COVERAGE_SINGLETON_ID, lastCoveredDate: date },
      { conflictPaths: ["id"] },
    );
  }

  private async refreshFreshnessGauge(): Promise<void> {
    const latest = await this.fxRates
      .createQueryBuilder("r")
      .select("MAX(r.rate_date)", "rateDate")
      .getRawOne<{ rateDate: string | Date | null }>();
    if (!latest?.rateDate) {
      this.metrics.setFxRatesFreshnessDays(0);
      return;
    }
    const rateDate =
      latest.rateDate instanceof Date
        ? toIsoDate(latest.rateDate)
        : latest.rateDate;
    const days = daysBetween(rateDate, toIsoDate(new Date()));
    this.metrics.setFxRatesFreshnessDays(days);
  }
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export function toIsoDate(value: Date): string {
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(value.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayIsoUtc(): string {
  return toIsoDate(new Date());
}

function normaliseDate(value: string | Date): string {
  return value instanceof Date ? toIsoDate(value) : value;
}

function nextDayIso(iso: string): string {
  const ms =
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10)),
    ) + 86_400_000;
  return toIsoDate(new Date(ms));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-export the typed historical row for callers that need it.
export type { FrankfurterHistoricalDay };
