import { Injectable, Logger } from "@nestjs/common";
import type { SignInOutcome } from "../entities/sign-in-event.entity";
import type { IdTokenVerificationReason } from "./google-id-token-verifier";
import { SignInEventsService } from "./sign-in-events.service";

export interface SignInAuditContext {
  correlationId: string;
  ip: string | null;
  userAgent: string | null;
}

export interface SignInAuditSuccessInput extends SignInAuditContext {
  userId: string;
}

export interface SignInAuditVerificationFailureInput
  extends SignInAuditContext {
  reason: IdTokenVerificationReason;
}

/**
 * Sole writer of `sign_in_events` rows for the `/auth/google` pipeline.
 *
 * Encapsulates the verification-reason → outcome mapping and the
 * "log + swallow" semantics: a failed audit write must never mask the
 * user-visible response (a 500 from auditing would be worse than a missing
 * forensic row). Logs the failure at error level with the correlation id so
 * the gap can be reconstructed from app logs.
 */
@Injectable()
export class SignInAuditor {
  private readonly logger = new Logger(SignInAuditor.name);

  constructor(private readonly events: SignInEventsService) {}

  async recordSuccess(input: SignInAuditSuccessInput): Promise<void> {
    await this.record({
      userId: input.userId,
      correlationId: input.correlationId,
      ip: input.ip,
      userAgent: input.userAgent,
      outcome: "success",
    });
  }

  async recordVerificationFailure(
    input: SignInAuditVerificationFailureInput,
  ): Promise<void> {
    await this.record({
      userId: null,
      correlationId: input.correlationId,
      ip: input.ip,
      userAgent: input.userAgent,
      outcome: outcomeFromVerificationReason(input.reason),
    });
  }

  async recordBadRequest(input: SignInAuditContext): Promise<void> {
    await this.record({
      userId: null,
      correlationId: input.correlationId,
      ip: input.ip,
      userAgent: input.userAgent,
      outcome: "failure_bad_request",
    });
  }

  async recordInternalFailure(input: SignInAuditContext): Promise<void> {
    await this.record({
      userId: null,
      correlationId: input.correlationId,
      ip: input.ip,
      userAgent: input.userAgent,
      outcome: "failure_internal",
    });
  }

  async recordRateLimited(input: SignInAuditContext): Promise<void> {
    await this.record({
      userId: null,
      correlationId: input.correlationId,
      ip: input.ip,
      userAgent: input.userAgent,
      outcome: "failure_rate_limited",
    });
  }

  private async record(input: {
    userId: string | null;
    correlationId: string;
    outcome: SignInOutcome;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> {
    try {
      await this.events.record(input);
    } catch (err) {
      this.logger.error(
        `Failed to persist sign_in_events row [cid=${input.correlationId}]`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

function outcomeFromVerificationReason(
  reason: IdTokenVerificationReason,
): SignInOutcome {
  switch (reason) {
    case "signature":
      return "failure_token_signature";
    case "expired":
      return "failure_token_expired";
    case "issuer":
      return "failure_token_issuer";
    case "audience":
      return "failure_token_audience";
    case "nonce_mismatch":
      return "failure_nonce_mismatch";
    case "malformed":
      return "failure_token_malformed";
  }
}
