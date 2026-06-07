import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MetricsService } from "@/metrics/metrics.service";
import { FxCoverage } from "../entities/fx-coverage.entity";
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

function buildFxRateRepoStub(latestRateDate: string | null) {
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

function buildCoverageRepoStub(initial: string | null) {
  const state: { lastCoveredDate: string | null } = {
    lastCoveredDate: initial,
  };
  const repo = {
    findOne: jest.fn(async () =>
      state.lastCoveredDate ? { lastCoveredDate: state.lastCoveredDate } : null,
    ),
    upsert: jest.fn(
      async (
        values: { id: number; lastCoveredDate: string } | undefined,
        _options: unknown,
      ) => {
        if (values) state.lastCoveredDate = values.lastCoveredDate;
      },
    ),
  };
  return { repo, state };
}

async function buildService(options: {
  client: FrankfurterClient;
  latestRateDate?: string | null;
  coverage?: string | null;
}): Promise<{
  service: FxFetchService;
  metrics: MetricsService;
  upserts: UpsertedBatch[];
  coverageState: { lastCoveredDate: string | null };
}> {
  const { repo: fxRateRepo, upserts } = buildFxRateRepoStub(
    options.latestRateDate ?? null,
  );
  const { repo: coverageRepo, state: coverageState } = buildCoverageRepoStub(
    options.coverage ?? null,
  );

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      MetricsService,
      FxFetchService,
      { provide: getRepositoryToken(FxRate), useValue: fxRateRepo },
      { provide: getRepositoryToken(FxCoverage), useValue: coverageRepo },
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
    coverageState,
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

  describe("fetchAndPersistLatest (currency filter)", () => {
    it("drops rates outside the supported quote set on persist", async () => {
      const client = {
        fetchLatestEurAnchored: jest.fn(async () => ({
          rateDate: "2026-06-07",
          baseCurrency: "EUR" as const,
          rates: { USD: "1.083", BRL: "5.42", JPY: "170", XYZ: "1" },
        })),
        fetchHistoricalEurAnchored: jest.fn(),
      } as unknown as FrankfurterClient;
      const { service, upserts } = await buildService({ client });

      const written = await service.fetchAndPersistLatest();

      expect(written).toBe(2);
      const codes = upserts[0]?.values
        .map((v) => v.quoteCurrency)
        .sort() as string[];
      expect(codes).toEqual(["BRL", "USD"]);
    });

    it("retries on transient failures and surfaces the success metric", async () => {
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

  describe("fetchAndPersistCatchUp", () => {
    it("first run fetches from FX_COVERAGE_START_DATE through today", async () => {
      const client = {
        fetchLatestEurAnchored: jest.fn(),
        fetchHistoricalEurAnchored: jest.fn(async () => [
          { rateDate: "2026-06-05", rates: { USD: "1.080" } },
        ]),
      } as unknown as FrankfurterClient;
      const { service, coverageState } = await buildService({
        client,
        coverage: null,
      });

      const result = await service.fetchAndPersistCatchUp("2026-06-07");

      expect(client.fetchHistoricalEurAnchored).toHaveBeenCalledWith({
        from: "2026-01-01",
        to: "2026-06-07",
      });
      expect(result.noop).toBe(false);
      expect(result.from).toBe("2026-01-01");
      expect(result.to).toBe("2026-06-07");
      expect(coverageState.lastCoveredDate).toBe("2026-06-07");
    });

    it("subsequent runs only fetch the gap and advance the watermark", async () => {
      const client = {
        fetchLatestEurAnchored: jest.fn(),
        fetchHistoricalEurAnchored: jest.fn(async () => [
          { rateDate: "2026-06-06", rates: { USD: "1.080" } },
          { rateDate: "2026-06-07", rates: { USD: "1.081" } },
        ]),
      } as unknown as FrankfurterClient;
      const { service, coverageState } = await buildService({
        client,
        coverage: "2026-06-05",
      });

      const result = await service.fetchAndPersistCatchUp("2026-06-07");

      expect(client.fetchHistoricalEurAnchored).toHaveBeenCalledWith({
        from: "2026-06-06",
        to: "2026-06-07",
      });
      expect(result.from).toBe("2026-06-06");
      expect(coverageState.lastCoveredDate).toBe("2026-06-07");
    });

    it("is a no-op when the watermark is already at today", async () => {
      const client = {
        fetchLatestEurAnchored: jest.fn(),
        fetchHistoricalEurAnchored: jest.fn(),
      } as unknown as FrankfurterClient;
      const { service, coverageState } = await buildService({
        client,
        coverage: "2026-06-07",
      });

      const result = await service.fetchAndPersistCatchUp("2026-06-07");

      expect(client.fetchHistoricalEurAnchored).not.toHaveBeenCalled();
      expect(result.noop).toBe(true);
      expect(result.persisted).toBe(0);
      expect(coverageState.lastCoveredDate).toBe("2026-06-07");
    });
  });
});
