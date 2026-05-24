import type { Provider } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import IORedis, { type Redis } from "ioredis";
import { REDIS_CLIENT, type RedisClient } from "./redis.client";

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
}

/**
 * ioredis-backed {@link RedisClient}.
 *
 * The limiter treats Redis as best-effort: connection errors fail open and
 * are surfaced via {@link RedisClient.eval} rejections. The retry strategy
 * here is intentionally short so a Redis outage degrades quickly rather
 * than queuing sign-in latency. Reconnects continue in the background so
 * the limiter automatically re-engages when Redis comes back.
 */
export class IoredisClient implements RedisClient {
  private readonly logger = new Logger(IoredisClient.name);
  private readonly client: Redis;

  constructor(options: RedisConnectionOptions) {
    this.client = new IORedis({
      host: options.host,
      port: options.port,
      password: options.password,
      lazyConnect: false,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempts) => Math.min(attempts * 200, 2000),
    });

    this.client.on("error", (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  eval(
    script: string,
    keys: readonly string[],
    args: ReadonlyArray<string | number>,
  ): Promise<unknown> {
    return this.client.eval(
      script,
      keys.length,
      ...keys,
      ...args.map((arg) => String(arg)),
    );
  }

  del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async close(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}

/**
 * Build the {@link IoredisClient} from process env. Throws at module
 * bootstrap if `REDIS_HOST` or `REDIS_PORT` are missing — the limiter is on
 * the critical path's failover layer, and silently defaulting would mask a
 * misconfigured deploy.
 */
export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): RedisClient => {
    const host = process.env.REDIS_HOST;
    const portRaw = process.env.REDIS_PORT;
    if (!host) throw new Error("REDIS_HOST must be set");
    if (!portRaw) throw new Error("REDIS_PORT must be set");
    const port = Number.parseInt(portRaw, 10);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(
        `REDIS_PORT must be a positive integer (got "${portRaw}")`,
      );
    }
    return new IoredisClient({
      host,
      port,
      password: process.env.REDIS_PASSWORD,
    });
  },
};
