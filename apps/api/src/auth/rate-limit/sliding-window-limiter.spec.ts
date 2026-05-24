import { Test } from "@nestjs/testing";
import { MetricsService } from "../../metrics/metrics.service";
import { LIMITER_CONFIG, type LimiterConfig } from "./limiter.config";
import { REDIS_CLIENT, type RedisClient } from "./redis.client";
import { SlidingWindowLimiter } from "./sliding-window-limiter";

interface LimiterStubs {
  ping: jest.Mock;
  eval: jest.Mock;
  del: jest.Mock;
  recordLimiterDegraded: jest.Mock;
}

async function buildLimiter(
  overrides: Partial<LimiterStubs> = {},
  configOverrides: Partial<LimiterConfig> = {},
): Promise<{ limiter: SlidingWindowLimiter } & LimiterStubs> {
  const stubs: LimiterStubs = {
    ping: jest.fn().mockResolvedValue("PONG"),
    eval: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    recordLimiterDegraded: jest.fn(),
    ...overrides,
  };

  const redisStub: RedisClient = {
    ping: stubs.ping,
    eval: stubs.eval,
    del: stubs.del,
  };
  const metricsStub: Pick<MetricsService, "recordLimiterDegraded"> = {
    recordLimiterDegraded: stubs.recordLimiterDegraded,
  };

  const config: LimiterConfig = {
    ip: { windowMs: 300_000, limit: 30 },
    identity: {
      thresholdFailures: 3,
      baseMs: 5000,
      capMs: 300_000,
      counterTtlSec: 3600,
    },
    ...configOverrides,
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      SlidingWindowLimiter,
      { provide: REDIS_CLIENT, useValue: redisStub },
      { provide: LIMITER_CONFIG, useValue: config },
      { provide: MetricsService, useValue: metricsStub },
    ],
  }).compile();

  return { limiter: moduleRef.get(SlidingWindowLimiter), ...stubs };
}

describe("SlidingWindowLimiter.checkIpRate", () => {
  it("returns allowed when the script reports under-cap", async () => {
    const { limiter, eval: evalMock } = await buildLimiter({
      eval: jest.fn().mockResolvedValue([1, 1, 0]),
    });

    const decision = await limiter.checkIpRate("203.0.113.5");

    expect(decision).toEqual({ allowed: true, degraded: false });
    expect(evalMock).toHaveBeenCalledTimes(1);
    const [, keys, args] = evalMock.mock.calls[0];
    expect(keys).toEqual(["auth:ratelimit:ip:203.0.113.5"]);
    expect(args[1]).toBe(300_000);
    expect(args[2]).toBe(30);
  });

  it("returns blocked with the script-reported retryAfterMs when at cap", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockResolvedValue([0, 30, 4321]),
    });

    const decision = await limiter.checkIpRate("203.0.113.5");

    expect(decision).toEqual({ allowed: false, retryAfterMs: 4321 });
  });

  it("fails open and reports degraded when Redis rejects", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    const decision = await limiter.checkIpRate("203.0.113.5");

    expect(decision).toEqual({ allowed: true, degraded: true });
  });

  it("returns allowed without invoking Redis when ip is null", async () => {
    const { limiter, eval: evalMock } = await buildLimiter();

    const decision = await limiter.checkIpRate(null);

    expect(decision).toEqual({ allowed: true, degraded: false });
    expect(evalMock).not.toHaveBeenCalled();
  });
});

describe("SlidingWindowLimiter.checkIdentityBackoff", () => {
  const identity = { provider: "google", subject: "sub-1" };

  it("returns allowed when the script reports under-threshold", async () => {
    const { limiter, eval: evalMock } = await buildLimiter({
      eval: jest.fn().mockResolvedValue([1, 0, 0]),
    });

    const decision = await limiter.checkIdentityBackoff(identity);

    expect(decision).toEqual({ allowed: true, degraded: false });
    expect(evalMock).toHaveBeenCalledTimes(1);
    const [, keys] = evalMock.mock.calls[0];
    expect(keys[0]).toMatch(/^auth:ratelimit:identity:/);
  });

  it("returns blocked with retryAfterMs when in cooldown", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockResolvedValue([0, 5, 12_500]),
    });

    const decision = await limiter.checkIdentityBackoff(identity);

    expect(decision).toEqual({ allowed: false, retryAfterMs: 12_500 });
  });

  it("fails open and reports degraded when Redis rejects", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockRejectedValue(new Error("connection lost")),
    });

    const decision = await limiter.checkIdentityBackoff(identity);

    expect(decision).toEqual({ allowed: true, degraded: true });
  });

  it("hashes the identity so the raw subject never appears in the Redis key", async () => {
    const { limiter, eval: evalMock } = await buildLimiter({
      eval: jest.fn().mockResolvedValue([1, 0, 0]),
    });

    await limiter.checkIdentityBackoff({
      provider: "google",
      subject: "raw-google-subject-leak",
    });

    const [, keys] = evalMock.mock.calls[0];
    expect(keys[0]).not.toContain("raw-google-subject-leak");
  });
});

describe("SlidingWindowLimiter.recordIdentityFailure", () => {
  const identity = { provider: "google", subject: "sub-1" };

  it("invokes Redis with the identity backoff key and config TTL", async () => {
    const { limiter, eval: evalMock } = await buildLimiter({
      eval: jest.fn().mockResolvedValue(1),
    });

    await limiter.recordIdentityFailure(identity);

    expect(evalMock).toHaveBeenCalledTimes(1);
    const [, keys, args] = evalMock.mock.calls[0];
    expect(keys[0]).toMatch(/^auth:ratelimit:identity:/);
    expect(args[1]).toBe(3600);
  });

  it("swallows Redis errors so a failed record never breaks sign-in", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockRejectedValue(new Error("nope")),
    });

    await expect(
      limiter.recordIdentityFailure(identity),
    ).resolves.toBeUndefined();
  });
});

describe("SlidingWindowLimiter.clearIdentityFailures", () => {
  it("deletes the identity backoff key", async () => {
    const { limiter, del } = await buildLimiter();

    await limiter.clearIdentityFailures({
      provider: "google",
      subject: "sub-1",
    });

    expect(del).toHaveBeenCalledTimes(1);
    const [key] = del.mock.calls[0];
    expect(key).toMatch(/^auth:ratelimit:identity:/);
  });

  it("swallows Redis errors", async () => {
    const { limiter } = await buildLimiter({
      del: jest.fn().mockRejectedValue(new Error("nope")),
    });

    await expect(
      limiter.clearIdentityFailures({ provider: "google", subject: "sub-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("SlidingWindowLimiter.isDegraded", () => {
  it("flips to true after a Redis failure and back to false after a successful op", async () => {
    const evalMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce([1, 1, 0]);
    const { limiter } = await buildLimiter({ eval: evalMock });

    expect(limiter.isDegraded()).toBe(false);

    await limiter.checkIpRate("203.0.113.5");
    expect(limiter.isDegraded()).toBe(true);

    await limiter.checkIpRate("203.0.113.5");
    expect(limiter.isDegraded()).toBe(false);
  });
});

describe("SlidingWindowLimiter.degradedCount", () => {
  it("increments monotonically every time an op fails open", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockRejectedValue(new Error("down")),
    });

    expect(limiter.degradedCount()).toBe(0);
    await limiter.checkIpRate("203.0.113.5");
    expect(limiter.degradedCount()).toBe(1);
    await limiter.checkIdentityBackoff({ provider: "google", subject: "s" });
    expect(limiter.degradedCount()).toBe(2);
    await limiter.recordIdentityFailure({ provider: "google", subject: "s" });
    expect(limiter.degradedCount()).toBe(3);
  });

  it("does not increment when ops succeed", async () => {
    const { limiter } = await buildLimiter({
      eval: jest.fn().mockResolvedValue([1, 1, 0]),
    });

    await limiter.checkIpRate("203.0.113.5");
    expect(limiter.degradedCount()).toBe(0);
  });

  it("emits the auth_limiter_degraded_total metric every time it fails open", async () => {
    const { limiter, recordLimiterDegraded } = await buildLimiter({
      eval: jest.fn().mockRejectedValue(new Error("down")),
    });

    await limiter.checkIpRate("203.0.113.5");
    await limiter.checkIdentityBackoff({ provider: "google", subject: "s" });
    await limiter.recordIdentityFailure({ provider: "google", subject: "s" });

    expect(recordLimiterDegraded).toHaveBeenCalledTimes(3);
  });
});
