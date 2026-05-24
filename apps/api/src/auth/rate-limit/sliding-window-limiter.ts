import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { MetricsService } from "../../metrics/metrics.service";
import { LIMITER_CONFIG, type LimiterConfig } from "./limiter.config";
import { REDIS_CLIENT, type RedisClient } from "./redis.client";

export type LimiterDecision =
  | { allowed: true; degraded: boolean }
  | { allowed: false; retryAfterMs: number };

export interface IdentityKey {
  provider: string;
  subject: string;
}

const IP_KEY_PREFIX = "auth:ratelimit:ip:";
const IDENTITY_KEY_PREFIX = "auth:ratelimit:identity:";

/**
 * Sliding-window sign-in attempt limiter backed by Redis.
 *
 * Two dimensions:
 * - **Per IP** — a ZSET sliding window. Each call adds an entry scored by
 *   `now_ms`; older scores are trimmed atomically and the cardinality
 *   compared to the configured limit.
 * - **Per identity** — an exponential-backoff counter keyed by
 *   `(provider, subject)`. Failures bump a counter; subsequent checks
 *   compute `baseMs * 2^(count - threshold)` (clipped to `capMs`) and
 *   block until that has elapsed since the last failure.
 *
 * Redis errors fail open: the call resolves as allowed and the limiter
 * marks itself degraded. The caller (AuthService) translates degraded
 * into a warn-level log + Prometheus counter; sign-in continues.
 */
@Injectable()
export class SlidingWindowLimiter {
  private readonly logger = new Logger(SlidingWindowLimiter.name);
  private degraded = false;
  private degradedTotal = 0;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @Inject(LIMITER_CONFIG) private readonly config: LimiterConfig,
    private readonly metrics: MetricsService,
  ) {}

  /** Most recent op flipped the limiter into a degraded (Redis-unreachable) state. */
  isDegraded(): boolean {
    return this.degraded;
  }

  /**
   * Monotonic count of how many limiter ops have fallen back to fail-open.
   * Surfaced to Phase 7's `auth_limiter_degraded_total` Prometheus counter.
   */
  degradedCount(): number {
    return this.degradedTotal;
  }

  async checkIpRate(ip: string | null): Promise<LimiterDecision> {
    if (!ip) {
      return { allowed: true, degraded: false };
    }
    const key = IP_KEY_PREFIX + ip;
    try {
      const result = await this.redis.eval(
        IP_SLIDING_WINDOW_SCRIPT,
        [key],
        [
          Date.now(),
          this.config.ip.windowMs,
          this.config.ip.limit,
          randomUUID(),
        ],
      );
      this.degraded = false;
      return decodeDecision(result);
    } catch (err) {
      this.markDegraded(err, "checkIpRate");
      return { allowed: true, degraded: true };
    }
  }

  async checkIdentityBackoff(identity: IdentityKey): Promise<LimiterDecision> {
    const key = identityKey(identity);
    try {
      const result = await this.redis.eval(
        IDENTITY_CHECK_SCRIPT,
        [key],
        [
          Date.now(),
          this.config.identity.baseMs,
          this.config.identity.capMs,
          this.config.identity.thresholdFailures,
        ],
      );
      this.degraded = false;
      return decodeDecision(result);
    } catch (err) {
      this.markDegraded(err, "checkIdentityBackoff");
      return { allowed: true, degraded: true };
    }
  }

  async recordIdentityFailure(identity: IdentityKey): Promise<void> {
    const key = identityKey(identity);
    try {
      await this.redis.eval(
        IDENTITY_RECORD_FAILURE_SCRIPT,
        [key],
        [Date.now(), this.config.identity.counterTtlSec],
      );
      this.degraded = false;
    } catch (err) {
      this.markDegraded(err, "recordIdentityFailure");
    }
  }

  async clearIdentityFailures(identity: IdentityKey): Promise<void> {
    const key = identityKey(identity);
    try {
      await this.redis.del(key);
      this.degraded = false;
    } catch (err) {
      this.markDegraded(err, "clearIdentityFailures");
    }
  }

  private markDegraded(err: unknown, op: string): void {
    this.degraded = true;
    this.degradedTotal += 1;
    this.metrics.recordLimiterDegraded();
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Limiter degraded (${op}): ${message}`);
  }
}

function identityKey(identity: IdentityKey): string {
  const hash = createHash("sha256")
    .update(`${identity.provider}:${identity.subject}`)
    .digest("hex");
  return IDENTITY_KEY_PREFIX + hash;
}

function decodeDecision(result: unknown): LimiterDecision {
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error(
      `Unexpected limiter script result: ${JSON.stringify(result)}`,
    );
  }
  const allowed = Number(result[0]);
  if (allowed === 1) {
    return { allowed: true, degraded: false };
  }
  const retryAfterMs = Math.max(0, Math.ceil(Number(result[2]) || 0));
  return { allowed: false, retryAfterMs };
}

/**
 * Atomic sliding-window check + insert.
 *
 * KEYS[1] = window key
 * ARGV[1] = now (ms)
 * ARGV[2] = windowMs
 * ARGV[3] = limit
 * ARGV[4] = member id (unique per call)
 *
 * Returns `{allowed, currentCount, retryAfterMs}`.
 */
const IP_SLIDING_WINDOW_SCRIPT = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = now - windowMs
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, windowStart - 1)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local oldestScore = tonumber(oldest[2]) or now
  local retry = (oldestScore + windowMs) - now
  if retry < 0 then retry = 0 end
  return {0, count, retry}
end
redis.call('ZADD', KEYS[1], now, member)
redis.call('PEXPIRE', KEYS[1], windowMs)
return {1, count + 1, 0}
`.trim();

/**
 * Identity-backoff *read* — checks whether `(provider, subject)` is in
 * cooldown without mutating state.
 *
 * KEYS[1] = identity key
 * ARGV[1] = now (ms)
 * ARGV[2] = baseMs
 * ARGV[3] = capMs
 * ARGV[4] = thresholdFailures
 *
 * Returns `{allowed, currentCount, retryAfterMs}`.
 */
const IDENTITY_CHECK_SCRIPT = `
local now = tonumber(ARGV[1])
local baseMs = tonumber(ARGV[2])
local capMs = tonumber(ARGV[3])
local threshold = tonumber(ARGV[4])
local raw = redis.call('HMGET', KEYS[1], 'count', 'lastFailureAt')
local count = tonumber(raw[1]) or 0
local last = tonumber(raw[2]) or 0
if count <= threshold then
  return {1, count, 0}
end
local pow = count - threshold - 1
local cooldown = baseMs * (2 ^ pow)
if cooldown > capMs then cooldown = capMs end
local remaining = (last + cooldown) - now
if remaining <= 0 then
  return {1, count, 0}
end
return {0, count, remaining}
`.trim();

/**
 * Identity-backoff *write* — increments the failure counter, refreshes
 * the last-failure timestamp, and applies the TTL.
 *
 * KEYS[1] = identity key
 * ARGV[1] = now (ms)
 * ARGV[2] = ttlSec
 *
 * Returns the new count.
 */
const IDENTITY_RECORD_FAILURE_SCRIPT = `
local count = redis.call('HINCRBY', KEYS[1], 'count', 1)
redis.call('HSET', KEYS[1], 'lastFailureAt', ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return count
`.trim();
