import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { FxFetchService } from "../services/fx-fetch.service";

interface TriggerBody {
  from?: string;
  to?: string;
}

interface TriggerResult {
  mode: "latest" | "range";
  persisted: number;
  from?: string;
  to?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dev-only trigger that runs the same FX fetch path the daily cron does.
 * Three modes:
 *  - no body              -> pull today's EUR-anchored rates (the prod cron)
 *  - `{from}`             -> backfill from `from` to today (inclusive)
 *  - `{from, to}`         -> backfill the explicit range
 *
 * Returns 404 in production so the surface is dev-only without an extra
 * env var.
 */
@Controller("internal/fx")
export class FxInternalController {
  constructor(private readonly fetcher: FxFetchService) {}

  @Post("fetch")
  @HttpCode(200)
  async fetch(@Body() body: TriggerBody = {}): Promise<TriggerResult> {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }

    if (!body.from && !body.to) {
      const persisted = await this.fetcher.fetchAndPersistLatest();
      return { mode: "latest", persisted };
    }

    if (!body.from) {
      throw new BadRequestException("`from` is required when `to` is provided");
    }

    const from = body.from;
    const to = body.to ?? todayIsoUtc();
    assertIsoDate(from, "from");
    assertIsoDate(to, "to");
    if (to < from) {
      throw new BadRequestException("`to` must be on or after `from`");
    }

    const persisted = await this.fetcher.fetchAndPersistRange(from, to);
    return { mode: "range", persisted, from, to };
  }
}

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE.test(value)) {
    throw new BadRequestException(`\`${field}\` must be YYYY-MM-DD`);
  }
}

function todayIsoUtc(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
