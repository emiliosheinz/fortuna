import type { OnModuleDestroy, Provider } from "@nestjs/common";
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
export class IoredisClient implements RedisClient, OnModuleDestroy {
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

    // Detach the underlying socket from libuv's "keep loop alive" ref
    // count. In normal operation the HTTP server keeps the process
    // running; on shutdown (or in tests after app.close()) we want the
    // process to exit even if ioredis still has a reconnect or command-
    // retry timer scheduled. Without this, Jest hangs after teardown
    // and prod processes won't honor SIGTERM cleanly. The stream is
    // recreated on every reconnect, so we unref on each connect event.
    this.client.on("connect", () => {
      this.client.stream?.unref();
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

  /**
   * Nest lifecycle hook — closes the underlying ioredis socket and stops
   * the reconnect timer on `app.close()`. Calling `disconnect(false)` after
   * `quit()` is critical: a `quit()` that fails (or even one that succeeds
   * while a reconnect timer is already scheduled) can leave a pending
   * `setTimeout` on the event loop, which makes Jest hang after the run
   * completes and would prevent prod from shutting down cleanly on SIGTERM.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client.status === "end") return;
    try {
      await this.client.quit();
    } catch {
      // Ignore: quit may reject when the connection was already broken
      // (e.g. Redis container stopped); disconnect below cleans up anyway.
    }
    this.client.disconnect(false);
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
