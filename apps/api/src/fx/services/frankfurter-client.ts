export interface FrankfurterLatestResponse {
  rateDate: string;
  baseCurrency: "EUR";
  rates: Record<string, string>;
}

export interface FrankfurterHistoricalRequest {
  from: string;
  to: string;
}

export interface FrankfurterHistoricalDay {
  rateDate: string;
  rates: Record<string, string>;
}

export type FrankfurterFetcher = (
  url: string,
) => Promise<FrankfurterHttpResponse>;

export interface FrankfurterHttpResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export interface FrankfurterClientOptions {
  endpoint?: string;
  fetcher?: FrankfurterFetcher;
}

const DEFAULT_ENDPOINT = "https://api.frankfurter.app";

interface RawLatestResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

interface RawHistoricalResponse {
  base?: string;
  rates?: Record<string, Record<string, number>>;
}

/**
 * Thin HTTP wrapper around frankfurter.app. The client itself is stateless and
 * fail-loud; retry / backoff / metrics live one layer up so the surface stays
 * small enough to unit-test without mocking timers.
 */
export class FrankfurterClient {
  private readonly endpoint: string;
  private readonly fetcher: FrankfurterFetcher;

  constructor(options: FrankfurterClientOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetcher = options.fetcher ?? defaultFetcher;
  }

  async fetchLatestEurAnchored(): Promise<FrankfurterLatestResponse> {
    const response = await this.fetcher(`${this.endpoint}/latest?base=EUR`);
    if (!response.ok) {
      throw new FrankfurterHttpError(response.status);
    }
    const body = JSON.parse(await response.text()) as RawLatestResponse;
    if (!body.date || !body.rates || body.base !== "EUR") {
      throw new FrankfurterShapeError(
        "frankfurter /latest response missing expected fields",
      );
    }
    return {
      rateDate: body.date,
      baseCurrency: "EUR",
      rates: stringifyRates(body.rates),
    };
  }

  async fetchHistoricalEurAnchored(
    request: FrankfurterHistoricalRequest,
  ): Promise<FrankfurterHistoricalDay[]> {
    const response = await this.fetcher(
      `${this.endpoint}/${request.from}..${request.to}?base=EUR`,
    );
    if (!response.ok) {
      throw new FrankfurterHttpError(response.status);
    }
    const body = JSON.parse(await response.text()) as RawHistoricalResponse;
    if (!body.rates || body.base !== "EUR") {
      throw new FrankfurterShapeError(
        "frankfurter historical response missing expected fields",
      );
    }
    return Object.entries(body.rates)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, rates]) => ({
        rateDate: date,
        rates: stringifyRates(rates),
      }));
  }
}

export class FrankfurterHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`frankfurter responded with HTTP ${status}`);
    this.name = "FrankfurterHttpError";
    this.status = status;
  }
}

export class FrankfurterShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrankfurterShapeError";
  }
}

function stringifyRates(rates: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [code, value] of Object.entries(rates)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    out[code] = value.toString();
  }
  return out;
}

async function defaultFetcher(url: string): Promise<FrankfurterHttpResponse> {
  const response = await fetch(url);
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
  };
}
