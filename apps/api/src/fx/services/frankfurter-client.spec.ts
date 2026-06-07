import {
  FrankfurterClient,
  FrankfurterHttpError,
  type FrankfurterHttpResponse,
  FrankfurterShapeError,
} from "./frankfurter-client";

function okResponse(body: unknown): FrankfurterHttpResponse {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

function errorResponse(status: number): FrankfurterHttpResponse {
  return {
    ok: false,
    status,
    text: async () => "",
  };
}

describe("FrankfurterClient.fetchHistoricalEurAnchored", () => {
  it("returns one entry per day, sorted by date ascending", async () => {
    const client = new FrankfurterClient({
      endpoint: "https://example.test",
      fetcher: async () =>
        okResponse({
          base: "EUR",
          rates: {
            "2026-06-02": { USD: 1.082 },
            "2026-06-01": { USD: 1.081 },
            "2026-06-03": { USD: 1.083 },
          },
        }),
    });

    const result = await client.fetchHistoricalEurAnchored({
      from: "2026-06-01",
      to: "2026-06-03",
    });

    expect(result.map((d) => d.rateDate)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
    expect(result[0]?.rates.USD).toBe("1.081");
  });

  it("throws FrankfurterHttpError on a non-2xx response", async () => {
    const client = new FrankfurterClient({
      fetcher: async () => errorResponse(503),
    });
    await expect(
      client.fetchHistoricalEurAnchored({
        from: "2026-06-01",
        to: "2026-06-03",
      }),
    ).rejects.toBeInstanceOf(FrankfurterHttpError);
  });

  it("throws FrankfurterShapeError when the upstream omits the rates map", async () => {
    const client = new FrankfurterClient({
      fetcher: async () => okResponse({ base: "EUR" }),
    });
    await expect(
      client.fetchHistoricalEurAnchored({
        from: "2026-06-01",
        to: "2026-06-03",
      }),
    ).rejects.toBeInstanceOf(FrankfurterShapeError);
  });
});
