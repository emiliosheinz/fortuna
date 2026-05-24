import { randomUUID } from "node:crypto";
import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { SignInAuditor } from "../services/sign-in-auditor";

/**
 * Catches `BadRequestException` on `POST /auth/google` so that
 * `ValidationPipe` (or any other source of 400) still produces a
 * `sign_in_events` row with `outcome = failure_bad_request` and a fresh
 * correlation id surfaced on the response body.
 *
 * Scope this filter to the route via `@UseFilters` on the handler — applying
 * it globally would intercept every 400 in the app, which would mis-audit
 * unrelated routes.
 */
@Catch(BadRequestException)
export class BadRequestAuditFilter implements ExceptionFilter {
  constructor(private readonly auditor: SignInAuditor) {}

  async catch(
    exception: BadRequestException,
    host: ArgumentsHost,
  ): Promise<void> {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId = randomUUID();
    await this.auditor.recordBadRequest({
      correlationId,
      ip: req.ip ?? null,
      userAgent: headerString(req.headers["user-agent"]),
    });

    res.status(exception.getStatus()).json({ correlationId });
  }
}

function headerString(header: string | string[] | undefined): string | null {
  if (header === undefined) return null;
  return Array.isArray(header) ? header.join(", ") : header;
}
