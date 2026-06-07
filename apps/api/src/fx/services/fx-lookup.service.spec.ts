import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FxRate } from "../entities/fx-rate.entity";
import { FxLookupService } from "./fx-lookup.service";

interface SeedRow {
  rate_date: string;
  base_currency: string;
  quote_currency: string;
  rate: string;
}

function buildRepoStub(rows: SeedRow[]) {
  return {
    createQueryBuilder: jest.fn(() => {
      const filters: Partial<{
        base: string;
        quote: string;
        date: string;
      }> = {};
      const builder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation((_clause, params) => {
          Object.assign(filters, params);
          return builder;
        }),
        andWhere: jest.fn().mockImplementation((_clause, params) => {
          Object.assign(filters, params);
          return builder;
        }),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => {
          const candidates = rows.filter(
            (row) =>
              row.base_currency === filters.base &&
              row.quote_currency === filters.quote &&
              row.rate_date <= (filters.date ?? "9999-12-31"),
          );
          candidates.sort((a, b) => (a.rate_date < b.rate_date ? 1 : -1));
          const best = candidates[0];
          return best ? { rate_date: best.rate_date, rate: best.rate } : null;
        }),
      };
      return builder;
    }),
  };
}

async function build(rows: SeedRow[]): Promise<FxLookupService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      FxLookupService,
      { provide: getRepositoryToken(FxRate), useValue: buildRepoStub(rows) },
    ],
  }).compile();
  return moduleRef.get(FxLookupService);
}

describe("FxLookupService.resolve", () => {
  it("returns identity when the transaction currency equals the base", async () => {
    const service = await build([]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "USD",
      baseCurrency: "USD",
    });
    expect(result).toEqual({
      unconvertible: false,
      rate: "1",
      rateDate: "2026-06-07",
      substituted: false,
    });
  });

  it("uses the EUR-anchored rate when base = EUR", async () => {
    const service = await build([
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "USD",
        rate: "1.083000",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "USD",
      baseCurrency: "EUR",
    });
    if (result.unconvertible) throw new Error("expected convertible");
    expect(result.rateDate).toBe("2026-06-07");
    expect(result.substituted).toBe(false);
    // 1 / 1.083000 ≈ 0.923361
    expect(Number(result.rate)).toBeCloseTo(0.923361, 6);
  });

  it("uses the EUR-anchored rate when transaction = EUR", async () => {
    const service = await build([
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "BRL",
        rate: "5.420000",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "EUR",
      baseCurrency: "BRL",
    });
    if (result.unconvertible) throw new Error("expected convertible");
    expect(result.rate).toBe("5.420000");
    expect(result.substituted).toBe(false);
  });

  it("triangulates through EUR for two non-pivot currencies", async () => {
    const service = await build([
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "USD",
        rate: "1.080000",
      },
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "BRL",
        rate: "5.400000",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "USD",
      baseCurrency: "BRL",
    });
    if (result.unconvertible) throw new Error("expected convertible");
    // 5.40 / 1.08 = 5
    expect(Number(result.rate)).toBeCloseTo(5, 6);
    expect(result.substituted).toBe(false);
  });

  it("falls back to the nearest prior rate and flags substituted", async () => {
    const service = await build([
      {
        rate_date: "2026-06-05",
        base_currency: "EUR",
        quote_currency: "USD",
        rate: "1.082000",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "EUR",
      baseCurrency: "USD",
    });
    if (result.unconvertible) throw new Error("expected convertible");
    expect(result.rateDate).toBe("2026-06-05");
    expect(result.substituted).toBe(true);
  });

  it("returns unconvertible when no rate exists for the transaction currency", async () => {
    const service = await build([
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "USD",
        rate: "1.083000",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "XYZ",
      baseCurrency: "USD",
    });
    expect(result.unconvertible).toBe(true);
    expect(result.rate).toBeNull();
    expect(result.rateDate).toBeNull();
  });

  it("returns unconvertible when one leg of triangulation is missing", async () => {
    const service = await build([
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "USD",
        rate: "1.080000",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "USD",
      baseCurrency: "XYZ",
    });
    expect(result.unconvertible).toBe(true);
  });

  it("flags substituted when only one triangulation leg falls back", async () => {
    const service = await build([
      {
        rate_date: "2026-06-07",
        base_currency: "EUR",
        quote_currency: "USD",
        rate: "1.080000",
      },
      {
        rate_date: "2026-06-04",
        base_currency: "EUR",
        quote_currency: "BRL",
        rate: "5.40",
      },
    ]);
    const result = await service.resolve({
      date: "2026-06-07",
      transactionCurrency: "USD",
      baseCurrency: "BRL",
    });
    if (result.unconvertible) throw new Error("expected convertible");
    expect(result.substituted).toBe(true);
    expect(result.rateDate).toBe("2026-06-04");
  });
});

describe("FxLookupService.convertAmount", () => {
  it("multiplies the amount by the resolved rate and rounds to two decimals", async () => {
    const service = await build([]);
    const result = service.convertAmount("100.00", {
      unconvertible: false,
      rate: "1.080000",
      rateDate: "2026-06-07",
      substituted: false,
    });
    expect(result).toBe("108.00");
  });

  it("returns null when the resolution is unconvertible", async () => {
    const service = await build([]);
    const result = service.convertAmount("100.00", {
      unconvertible: true,
      rate: null,
      rateDate: null,
      substituted: false,
    });
    expect(result).toBeNull();
  });
});
