import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { MetricsService } from "./metrics.service";

/**
 * Prometheus scrape endpoint.
 *
 * Public endpoint by HTTP layering — restrict it at the reverse proxy /
 * network level in any deployment that exposes the API to the open
 * internet (see `docker-compose.prod.yaml` and the runbook).
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get("metrics")
  async scrape(@Res() res: Response): Promise<void> {
    res.setHeader("Content-Type", this.metrics.contentType());
    res.send(await this.metrics.scrape());
  }
}
