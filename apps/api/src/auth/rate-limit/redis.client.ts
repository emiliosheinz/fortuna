/**
 * Thin internal interface over the Redis primitives consumed by the auth
 * rate limiter. Concrete implementations (ioredis today, conceivably
 * node-redis or a fake later) plug in behind a Nest DI token without
 * touching call sites in `auth/`.
 */
export interface RedisClient {
  /** Round-trip a PING; resolves with the server's reply ("PONG"). */
  ping(): Promise<string>;
  /**
   * Run a Lua script atomically.
   *
   * Return shapes vary per script: ioredis surfaces Lua numbers as JS
   * numbers and tables as arrays, so the caller is responsible for
   * narrowing the result.
   */
  eval(
    script: string,
    keys: readonly string[],
    args: ReadonlyArray<string | number>,
  ): Promise<unknown>;
  /** Delete a key; resolves with the number of keys removed (0 or 1). */
  del(key: string): Promise<number>;
}

/** DI token used by both the provider factory and the limiter. */
export const REDIS_CLIENT = Symbol("RedisClient");
