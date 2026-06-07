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
      const result = await this.fetcher.fetchAndPersistCatchUp();
      if (result.noop) {
        this.logger.log("Daily FX catch-up no-op (coverage already at today)");
      } else {
        this.logger.log(
          `Daily FX catch-up persisted ${result.persisted} row(s) over ${result.from}..${result.to}`,
        );
      }
    } catch (error) {
      this.logger.error("Daily FX catch-up failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
