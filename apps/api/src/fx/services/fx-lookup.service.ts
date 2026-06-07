import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FxRate } from "../entities/fx-rate.entity";

export interface FxResolutionInput {
  date: string;
  transactionCurrency: string;
  baseCurrency: string;
}

export type FxResolution =
  | {
      unconvertible: false;
      rate: string;
      rateDate: string;
      substituted: boolean;
    }
  | {
      unconvertible: true;
      rate: null;
      rateDate: null;
      substituted: false;
    };

interface NearestPriorRow {
  rateDate: string;
  rate: string;
}

const PIVOT = "EUR" as const;

@Injectable()
export class FxLookupService {
  constructor(
    @InjectRepository(FxRate)
    private readonly fxRates: Repository<FxRate>,
  ) {}

  async resolve(input: FxResolutionInput): Promise<FxResolution> {
    if (input.transactionCurrency === input.baseCurrency) {
      return identity(input.date);
    }

    if (input.baseCurrency === PIVOT) {
      const leg = await this.nearestPrior(
        input.date,
        input.transactionCurrency,
      );
      if (!leg) return UNCONVERTIBLE;
      const inverted = invert(leg.rate);
      return {
        unconvertible: false,
        rate: inverted,
        rateDate: leg.rateDate,
        substituted: leg.rateDate !== input.date,
      };
    }

    if (input.transactionCurrency === PIVOT) {
      const leg = await this.nearestPrior(input.date, input.baseCurrency);
      if (!leg) return UNCONVERTIBLE;
      return {
        unconvertible: false,
        rate: leg.rate,
        rateDate: leg.rateDate,
        substituted: leg.rateDate !== input.date,
      };
    }

    const [fromLeg, toLeg] = await Promise.all([
      this.nearestPrior(input.date, input.transactionCurrency),
      this.nearestPrior(input.date, input.baseCurrency),
    ]);
    if (!fromLeg || !toLeg) return UNCONVERTIBLE;
    const rate = divide(toLeg.rate, fromLeg.rate);
    const rateDate =
      fromLeg.rateDate <= toLeg.rateDate ? fromLeg.rateDate : toLeg.rateDate;
    return {
      unconvertible: false,
      rate,
      rateDate,
      substituted: rateDate !== input.date,
    };
  }

  /**
   * Convert a recorded amount (decimal string) to the base currency using a
   * resolved FX result. Returns null when the resolution is unconvertible.
   * Output is rounded once to 2 decimal places to match `numeric(18, 2)`.
   */
  convertAmount(amount: string, resolution: FxResolution): string | null {
    if (resolution.unconvertible) return null;
    const value = Number(amount) * Number(resolution.rate);
    if (!Number.isFinite(value)) return null;
    return value.toFixed(2);
  }

  private async nearestPrior(
    date: string,
    quote: string,
  ): Promise<NearestPriorRow | null> {
    const row = await this.fxRates
      .createQueryBuilder("r")
      .select(["r.rate_date AS rate_date", "r.rate AS rate"])
      .where("r.base_currency = :base", { base: PIVOT })
      .andWhere("r.quote_currency = :quote", { quote })
      .andWhere("r.rate_date <= :date", { date })
      .orderBy("r.rate_date", "DESC")
      .limit(1)
      .getRawOne<{ rate_date: string | Date; rate: string }>();
    if (!row) return null;
    return {
      rateDate:
        row.rate_date instanceof Date
          ? toIsoDate(row.rate_date)
          : row.rate_date,
      rate: row.rate,
    };
  }
}

const UNCONVERTIBLE: FxResolution = {
  unconvertible: true,
  rate: null,
  rateDate: null,
  substituted: false,
};

function identity(date: string): FxResolution {
  return {
    unconvertible: false,
    rate: "1",
    rateDate: date,
    substituted: false,
  };
}

function invert(rate: string): string {
  return divide("1", rate);
}

function divide(numerator: string, denominator: string): string {
  const value = Number(numerator) / Number(denominator);
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(6);
}

function toIsoDate(value: Date): string {
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(value.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
