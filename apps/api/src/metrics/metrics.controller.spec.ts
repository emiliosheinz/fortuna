import type { Response } from "express";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

function buildResponseStub(): Pick<Response, "setHeader" | "send"> & {
  headers: Record<string, string>;
  body: string | null;
} {
  const stub = {
    headers: {} as Record<string, string>,
    body: null as string | null,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
  };
  return stub;
}

describe("MetricsController", () => {
  it("returns the registry scrape with prom-client content type", async () => {
    const service = new MetricsService();
    service.recordSignInOutcome("success");
    const controller = new MetricsController(service);

    const res = buildResponseStub();
    await controller.scrape(res as unknown as Response);

    expect(res.headers["Content-Type"]).toBe(service.contentType());
    expect(res.body).toContain("auth_signin_attempts_total");
  });
});
