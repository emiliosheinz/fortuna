import { Controller, HttpCode, NotFoundException, Post } from "@nestjs/common";
import { FxFetchService } from "../services/fx-fetch.service";

interface TriggerResult {
  persisted: number;
  from: string;
  to: string;
  noop: boolean;
}

/**
 * Dev-only trigger that runs the same self-healing catch-up job the daily
 * cron fires in production. Returns 404 in production so the surface is
 * dev-only without an extra env var.
 */
@Controller("internal/fx")
export class FxInternalController {
  constructor(private readonly fetcher: FxFetchService) {}

  @Post("fetch")
  @HttpCode(200)
  async fetch(): Promise<TriggerResult> {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }
    return this.fetcher.fetchAndPersistCatchUp();
  }
}
