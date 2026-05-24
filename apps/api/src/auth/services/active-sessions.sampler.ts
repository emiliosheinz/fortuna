import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MetricsService } from "../../metrics/metrics.service";
import { SessionsService } from "./sessions.service";

/**
 * Periodically samples the number of active sessions and updates the
 * `auth_sessions_active` Prometheus gauge.
 *
 * Errors are logged and swallowed: a transient DB failure must not crash
 * the scheduler. The gauge's last successful value remains visible until
 * the next sample succeeds.
 */
@Injectable()
export class ActiveSessionsSampler {
  private readonly logger = new Logger(ActiveSessionsSampler.name);

  constructor(
    private readonly sessions: SessionsService,
    private readonly metrics: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "auth-sessions-active-sampler",
  })
  async sample(): Promise<void> {
    try {
      const count = await this.sessions.countActive();
      this.metrics.setActiveSessions(count);
    } catch (err) {
      this.logger.warn(
        `Active-sessions sample failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
