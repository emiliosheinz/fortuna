import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MetricsService } from "@/metrics/metrics.service";
import { FxRate } from "../entities/fx-rate.entity";
import { FrankfurterClient, FrankfurterHttpError } from "./frankfurter-client";
import {
  daysBetween,
  FX_FETCH_RETRY_OPTIONS,
  FX_FRANKFURTER_CLIENT,
  FxFetchService,
} from "./fx-fetch.service";

interface UpsertedBatch {
  values: Array<Record<string, unknown>>;
}

function buildRepoStub(latestRateDate: string | null) {
  const upserts: UpsertedBatch[] = [];
  const repo = {
    upsert: jest.fn(async (values: Array<Record<string, unknown>>) => {
      upserts.push({ values });
    }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ rateDate: latestRateDate })),
    })),
  };
  return { repo, upserts };
}

async function buildService(options: {
  client: FrankfurterClient;
  latestRateDate?: string | null;
  retryOptions?: Parameters<typeof Test.createTestingModule>[0];
}): Promise<{
  service: FxFetchService;
  metrics: MetricsService;
  upserts: UpsertedBatch[];
}> {
  const { repo, upserts } = buildRepoStub(options.latestRateDate ?? null);

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      MetricsService,
      FxFetchService,
      { provide: getRepositoryToken(FxRate), useValue: repo },
      { provide: FX_FRANKFURTER_CLIENT, useValue: options.client },
      {
        provide: FX_FETCH_RETRY_OPTIONS,
        useValue: {
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 1,
          sleep: () => Promise.resolve(),
        },
      },
    ],
  }).compile();

  return {
    service: moduleRef.get(FxFetchService),
    metrics: moduleRef.get(MetricsService),
    upserts,
  };
}

describe("FxFetchService", () => {
  describe("daysBetween", () => {
    it("returns 0 for the same date", () => {
      expect(daysBetween("2026-06-07", "2026-06-07")).toBe(0);
    });
    it("returns the absolute day delta", () => {
      expect(daysBetween("2026-06-01", "2026-06-07")).toBe(6);
    });
    it("clamps to 0 when from is after to", () => {
      expect(daysBetween("2026-06-10", "2026-06-07")).toBe(0);
    });
  });

  describe("fetchAndPersistLatest", () => {
    it("upserts one row per quote currency and records a success metric", async () => {
      const client = {
        fetchLatestEurAnchored: jest.fn(async () => ({
          rateDate: "2026-06-07",
          baseCurrency: "EUR" as const,
          rates: { USD: "1.083", BRL: "5.42" },
        })),
        fetchHistoricalEurAnchored: jest.fn(),
      } as unknown as FrankfurterClient;
      const { service, metrics, upserts } = await buildService({ client });

      const written = await service.fetchAndPersistLatest();

      expect(written).toBe(2);
      expect(upserts).toHaveLength(1);
      const codes = upserts[0]?.values
        .map((v) => v.quoteCurrency)
        .sort() as string[];
      expect(codes).toEqual(["BRL", "USD"]);
      const text = await metrics.scrape();
      expect(text).toContain('fx_fetch_attempts_total{result="success"} 1');
    });

    it("retries on a transient HTTP failure then succeeds", async () => {
      const calls = jest
        .fn<Promise<unknown>, []>()
        .mockRejectedValueOnce(new FrankfurterHttpError(502))
        .mockResolvedValueOnce({
          rateDate: "2026-06-07",
          baseCurrency: "EUR" as const,
          rates: { USD: "1.083" },
        });
      const client = {
        fetchLatestEurAnchored: calls,
        fetchHistoricalEurAnchored: jest.fn(),
      } as unknown as FrankfurterClient;

      const { service, metrics } = await buildService({ client });
      await service.fetchAndPersistLatest();

      expect(calls).toHaveBeenCalledTimes(2);
      const text = await metrics.scrape();
      expect(text).toContain('fx_fetch_attempts_total{result="retry"} 1');
      expect(text).toContain('fx_fetch_attempts_total{result="success"} 1');
    });

    it("counts a final-attempt failure and rethrows", async () => {
      const client = {
        fetchLatestEurAnchored: jest
          .fn<Promise<unknown>, []>()
          .mockRejectedValue(new FrankfurterHttpError(500)),
        fetchHistoricalEurAnchored: jest.fn(),
      } as unknown as FrankfurterClient;

      const { service, metrics } = await buildService({ client });
      await expect(service.fetchAndPersistLatest()).rejects.toBeInstanceOf(
        FrankfurterHttpError,
      );

      const text = await metrics.scrape();
      expect(text).toContain('fx_fetch_attempts_total{result="retry"} 2');
      expect(text).toContain('fx_fetch_attempts_total{result="failure"} 1');
    });
  });
});
