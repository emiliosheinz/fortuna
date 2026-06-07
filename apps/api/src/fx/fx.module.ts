import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MetricsModule } from "@/metrics/metrics.module";
import { FxInternalController } from "./controllers/fx-internal.controller";
import { FxCoverage } from "./entities/fx-coverage.entity";
import { FxRate } from "./entities/fx-rate.entity";
import { FrankfurterClient } from "./services/frankfurter-client";
import {
  FX_FETCH_RETRY_OPTIONS,
  FX_FRANKFURTER_CLIENT,
  FxFetchService,
} from "./services/fx-fetch.service";
import { FxLookupService } from "./services/fx-lookup.service";
import { FxScheduledJob } from "./services/fx-scheduled-job";

/**
 * Owns the FX rate table, the upstream pull, the scheduled job, and the
 * read-time lookup. Lives outside `cashflow/` so other future domains
 * (holdings, forecasting, budgets) can consume the same lookup without
 * routing through the cashflow module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FxRate, FxCoverage]), MetricsModule],
  controllers: [FxInternalController],
  providers: [
    FxLookupService,
    FxFetchService,
    FxScheduledJob,
    {
      provide: FX_FRANKFURTER_CLIENT,
      useFactory: () => new FrankfurterClient(),
    },
    { provide: FX_FETCH_RETRY_OPTIONS, useValue: {} },
  ],
  exports: [FxLookupService, FxFetchService],
})
export class FxModule {}
