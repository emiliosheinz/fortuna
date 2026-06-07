import { Test } from "@nestjs/testing";
import { MetricsService } from "./metrics.service";

async function buildService(): Promise<MetricsService> {
  const moduleRef = await Test.createTestingModule({
    providers: [MetricsService],
  }).compile();
  return moduleRef.get(MetricsService);
}

async function metricsText(service: MetricsService): Promise<string> {
  return service.scrape();
}

describe("MetricsService", () => {
  describe("auth_signin_attempts_total", () => {
    it("increments per outcome label", async () => {
      const service = await buildService();
      service.recordSignInOutcome("success");
      service.recordSignInOutcome("success");
      service.recordSignInOutcome("failure_rate_limited");

      const text = await metricsText(service);
      expect(text).toContain('auth_signin_attempts_total{outcome="success"} 2');
      expect(text).toContain(
        'auth_signin_attempts_total{outcome="failure_rate_limited"} 1',
      );
    });
  });

  describe("auth_signin_duration_seconds", () => {
    it("observes durations in seconds", async () => {
      const service = await buildService();
      service.observeSignInDuration(0.42);

      const text = await metricsText(service);
      expect(text).toContain("auth_signin_duration_seconds_bucket");
      expect(text).toMatch(/auth_signin_duration_seconds_count\s+1/);
    });
  });

  describe("auth_session_creations_total", () => {
    it("counts session mints", async () => {
      const service = await buildService();
      service.recordSessionCreation();
      service.recordSessionCreation();

      const text = await metricsText(service);
      expect(text).toMatch(/auth_session_creations_total\s+2/);
    });
  });

  describe("auth_session_revocations_total", () => {
    it("counts revocations by reason", async () => {
      const service = await buildService();
      service.recordSessionRevocation("user_signout");
      service.recordSessionRevocation("user_revoke_other");
      service.recordSessionRevocation("account_deletion");

      const text = await metricsText(service);
      expect(text).toContain(
        'auth_session_revocations_total{reason="user_signout"} 1',
      );
      expect(text).toContain(
        'auth_session_revocations_total{reason="user_revoke_other"} 1',
      );
      expect(text).toContain(
        'auth_session_revocations_total{reason="account_deletion"} 1',
      );
    });
  });

  describe("auth_account_deletions_total", () => {
    it("counts account deletions", async () => {
      const service = await buildService();
      service.recordAccountDeletion();

      const text = await metricsText(service);
      expect(text).toMatch(/auth_account_deletions_total\s+1/);
    });
  });

  describe("auth_rate_limiter_blocks_total", () => {
    it("counts limiter blocks", async () => {
      const service = await buildService();
      service.recordRateLimiterBlock();
      service.recordRateLimiterBlock();

      const text = await metricsText(service);
      expect(text).toMatch(/auth_rate_limiter_blocks_total\s+2/);
    });
  });

  describe("auth_limiter_degraded_total", () => {
    it("counts degraded fail-open events", async () => {
      const service = await buildService();
      service.recordLimiterDegraded();

      const text = await metricsText(service);
      expect(text).toMatch(/auth_limiter_degraded_total\s+1/);
    });
  });

  describe("auth_sessions_active", () => {
    it("sets the active-sessions gauge", async () => {
      const service = await buildService();
      service.setActiveSessions(42);

      const text = await metricsText(service);
      expect(text).toMatch(/auth_sessions_active\s+42/);
    });
  });

  describe("fx_fetch_attempts_total", () => {
    it("counts FX fetch attempts by result label", async () => {
      const service = await buildService();
      service.recordFxFetchAttempt("success");
      service.recordFxFetchAttempt("retry");
      service.recordFxFetchAttempt("retry");
      service.recordFxFetchAttempt("failure");

      const text = await metricsText(service);
      expect(text).toContain('fx_fetch_attempts_total{result="success"} 1');
      expect(text).toContain('fx_fetch_attempts_total{result="retry"} 2');
      expect(text).toContain('fx_fetch_attempts_total{result="failure"} 1');
    });
  });

  describe("fx_fetch_last_success_timestamp_seconds", () => {
    it("sets the last-success epoch gauge", async () => {
      const service = await buildService();
      service.setFxFetchLastSuccessTimestampSeconds(1_700_000_000);

      const text = await metricsText(service);
      expect(text).toMatch(
        /fx_fetch_last_success_timestamp_seconds\s+1700000000/,
      );
    });
  });

  describe("fx_rates_freshness_days", () => {
    it("sets the rate freshness gauge", async () => {
      const service = await buildService();
      service.setFxRatesFreshnessDays(2);

      const text = await metricsText(service);
      expect(text).toMatch(/fx_rates_freshness_days\s+2/);
    });
  });

  describe("contentType", () => {
    it("exposes the prom-client content type for /metrics responses", async () => {
      const service = await buildService();
      expect(service.contentType()).toMatch(/text\/plain/);
    });
  });
});
