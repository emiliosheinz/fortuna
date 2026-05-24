import type { Provider } from "@nestjs/common";

/** Sliding-window parameters per limiter dimension. */
export interface LimiterConfig {
  ip: {
    /** Window length in milliseconds. */
    windowMs: number;
    /** Maximum events allowed within the window. */
    limit: number;
  };
  identity: {
    /** Failures within the TTL before backoff applies. */
    thresholdFailures: number;
    /** Initial cooldown after the (thresholdFailures + 1)-th failure, in ms. */
    baseMs: number;
    /** Absolute upper bound on a single cooldown, in ms. */
    capMs: number;
    /** TTL on the failure counter, in seconds. Counter resets after this. */
    counterTtlSec: number;
  };
}

export const LIMITER_CONFIG = Symbol("LimiterConfig");

const DEFAULT_CONFIG: LimiterConfig = {
  ip: {
    windowMs: 5 * 60_000,
    limit: 30,
  },
  identity: {
    thresholdFailures: 3,
    baseMs: 5_000,
    capMs: 5 * 60_000,
    counterTtlSec: 60 * 60,
  },
};

export const limiterConfigProvider: Provider = {
  provide: LIMITER_CONFIG,
  useValue: DEFAULT_CONFIG,
};
