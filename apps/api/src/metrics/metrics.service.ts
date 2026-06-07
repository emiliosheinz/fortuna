import { Injectable } from "@nestjs/common";
import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry as PromRegistry,
  type Registry,
} from "prom-client";
import type { SignInOutcome } from "../auth/entities/sign-in-event.entity";

export type SessionRevocationReason =
  | "user_signout"
  | "user_revoke_other"
  | "account_deletion"
  | "expiry";

export type FxFetchResult = "success" | "retry" | "failure";

/**
 * Holds the Prometheus registry and the `auth_*` metrics the design enumerates
 * under "Monitoring & Observability". Service-method helpers shield call sites
 * from prom-client semantics (labels, buckets) so individual increments stay
 * one-liners.
 *
 * Each instance owns its own {@link Registry} so unit tests can build a fresh
 * service per spec without colliding on global state.
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly signInAttempts: Counter<"outcome">;
  private readonly signInDuration: Histogram<string>;
  private readonly sessionCreations: Counter<string>;
  private readonly sessionRevocations: Counter<"reason">;
  private readonly accountDeletions: Counter<string>;
  private readonly rateLimiterBlocks: Counter<string>;
  private readonly limiterDegraded: Counter<string>;
  private readonly sessionsActive: Gauge<string>;
  private readonly fxFetchAttempts: Counter<"result">;
  private readonly fxFetchLastSuccessTimestampSeconds: Gauge<string>;
  private readonly fxRatesFreshnessDays: Gauge<string>;

  constructor() {
    this.registry = new PromRegistry();
    collectDefaultMetrics({ register: this.registry });

    this.signInAttempts = new Counter({
      name: "auth_signin_attempts_total",
      help: "Sign-in attempts grouped by terminal outcome.",
      labelNames: ["outcome"],
      registers: [this.registry],
    });

    this.signInDuration = new Histogram({
      name: "auth_signin_duration_seconds",
      help: "End-to-end /auth/google handler latency in seconds.",
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.sessionCreations = new Counter({
      name: "auth_session_creations_total",
      help: "Sessions minted via successful sign-in.",
      registers: [this.registry],
    });

    this.sessionRevocations = new Counter({
      name: "auth_session_revocations_total",
      help: "Session revocations grouped by reason.",
      labelNames: ["reason"],
      registers: [this.registry],
    });

    this.accountDeletions = new Counter({
      name: "auth_account_deletions_total",
      help: "Self-service account deletions.",
      registers: [this.registry],
    });

    this.rateLimiterBlocks = new Counter({
      name: "auth_rate_limiter_blocks_total",
      help: "Sign-in attempts blocked by the IP or identity limiter.",
      registers: [this.registry],
    });

    this.limiterDegraded = new Counter({
      name: "auth_limiter_degraded_total",
      help: "Limiter operations that fell back to fail-open because Redis was unreachable.",
      registers: [this.registry],
    });

    this.sessionsActive = new Gauge({
      name: "auth_sessions_active",
      help: "Active sessions (non-revoked, non-expired). Sampled periodically.",
      registers: [this.registry],
    });

    this.fxFetchAttempts = new Counter({
      name: "fx_fetch_attempts_total",
      help: "FX rate fetch attempts grouped by terminal result.",
      labelNames: ["result"],
      registers: [this.registry],
    });

    this.fxFetchLastSuccessTimestampSeconds = new Gauge({
      name: "fx_fetch_last_success_timestamp_seconds",
      help: "Unix epoch (seconds) of the most recent successful FX fetch.",
      registers: [this.registry],
    });

    this.fxRatesFreshnessDays = new Gauge({
      name: "fx_rates_freshness_days",
      help: "Days since the most recent stored FX rate_date.",
      registers: [this.registry],
    });
  }

  recordSignInOutcome(outcome: SignInOutcome): void {
    this.signInAttempts.inc({ outcome });
  }

  observeSignInDuration(seconds: number): void {
    this.signInDuration.observe(seconds);
  }

  recordSessionCreation(): void {
    this.sessionCreations.inc();
  }

  recordSessionRevocation(reason: SessionRevocationReason): void {
    this.sessionRevocations.inc({ reason });
  }

  recordAccountDeletion(): void {
    this.accountDeletions.inc();
  }

  recordRateLimiterBlock(): void {
    this.rateLimiterBlocks.inc();
  }

  recordLimiterDegraded(): void {
    this.limiterDegraded.inc();
  }

  setActiveSessions(count: number): void {
    this.sessionsActive.set(count);
  }

  recordFxFetchAttempt(result: FxFetchResult): void {
    this.fxFetchAttempts.inc({ result });
  }

  setFxFetchLastSuccessTimestampSeconds(epochSeconds: number): void {
    this.fxFetchLastSuccessTimestampSeconds.set(epochSeconds);
  }

  setFxRatesFreshnessDays(days: number): void {
    this.fxRatesFreshnessDays.set(days);
  }

  scrape(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
