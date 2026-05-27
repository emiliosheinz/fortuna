import { Global, Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

/**
 * Global so auth/users services can inject {@link MetricsService} without
 * having to re-import this module each time. Phase 7 adds a single
 * scrape endpoint at `GET /metrics`. Per-feature samplers (e.g. the
 * active-sessions gauge sampler in `auth`) live alongside the services
 * they query, so this module stays free of cross-module dependencies.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
