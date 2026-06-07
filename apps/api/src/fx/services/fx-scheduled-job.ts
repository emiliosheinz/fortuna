import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FxFetchService } from "./fx-fetch.service";

/**
 * Fires the daily FX pull once per day. Upserts at the persistence layer make
 * repeat firings idempotent, so manual reruns or out-of-band invocations from
 * `runOnce()` are safe.
 */
@Injectable()
export class FxScheduledJob {
  private readonly logger = new Logger(FxScheduledJob.name);

  constructor(private readonly fetcher: FxFetchService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: "fx-daily-fetch" })
  async handleDailyFetch(): Promise<void> {
    await this.runOnce();
  }

  async runOnce(): Promise<void> {
    try {
      const persisted = await this.fetcher.fetchAndPersistLatest();
      this.logger.log(`Daily FX fetch persisted ${persisted} rate row(s)`);
    } catch (error) {
      this.logger.error("Daily FX fetch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
