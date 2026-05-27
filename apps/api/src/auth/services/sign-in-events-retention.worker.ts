import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  SIGN_IN_EVENT_RETENTION_DAYS,
  SignInEventsService,
} from "./sign-in-events.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Periodically clears `ip` + `ua_hash` on `sign_in_events` older than the
 * retention window. Outcome + timestamp are preserved indefinitely for
 * long-term abuse analysis. Runs daily; failures are logged and swallowed
 * so a transient DB error never crashes the scheduler.
 */
@Injectable()
export class SignInEventsRetentionWorker {
  private readonly logger = new Logger(SignInEventsRetentionWorker.name);

  constructor(private readonly signInEvents: SignInEventsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: "sign-in-events-retention",
  })
  async runRetentionSweep(): Promise<void> {
    const cutoff = new Date(Date.now() - SIGN_IN_EVENT_RETENTION_DAYS * DAY_MS);
    try {
      const affected = await this.signInEvents.pruneOlderThan(cutoff);
      this.logger.log(
        `Retention sweep cleared ${affected} sign_in_events rows older than ${cutoff.toISOString()}`,
      );
    } catch (err) {
      this.logger.error(
        "Retention sweep failed",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
