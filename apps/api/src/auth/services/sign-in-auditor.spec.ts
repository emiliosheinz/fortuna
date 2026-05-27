import { Test } from "@nestjs/testing";
import { MetricsService } from "../../metrics/metrics.service";
import type { SignInOutcome } from "../entities/sign-in-event.entity";
import type { IdTokenVerificationReason } from "./google-id-token-verifier";
import { SignInAuditor } from "./sign-in-auditor";
import { SignInEventsService } from "./sign-in-events.service";

interface AuditorStubs {
  record: jest.Mock;
  recordSignInOutcome: jest.Mock;
  recordRateLimiterBlock: jest.Mock;
}

async function buildAuditor(
  overrides: Partial<AuditorStubs> = {},
): Promise<{ auditor: SignInAuditor } & AuditorStubs> {
  const stubs: AuditorStubs = {
    record: jest.fn().mockResolvedValue(undefined),
    recordSignInOutcome: jest.fn(),
    recordRateLimiterBlock: jest.fn(),
    ...overrides,
  };
  const eventsStub: Pick<SignInEventsService, "record"> = {
    record: stubs.record,
  };
  const metricsStub: Pick<
    MetricsService,
    "recordSignInOutcome" | "recordRateLimiterBlock"
  > = {
    recordSignInOutcome: stubs.recordSignInOutcome,
    recordRateLimiterBlock: stubs.recordRateLimiterBlock,
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SignInAuditor,
      { provide: SignInEventsService, useValue: eventsStub },
      { provide: MetricsService, useValue: metricsStub },
    ],
  }).compile();
  return { auditor: moduleRef.get(SignInAuditor), ...stubs };
}

const context = {
  correlationId: "cid-1",
  ip: "203.0.113.1",
  userAgent: "Mozilla/5.0",
};

describe("SignInAuditor", () => {
  it("recordSuccess writes a success row with the user id", async () => {
    const { auditor, record } = await buildAuditor();
    await auditor.recordSuccess({ ...context, userId: "user-1" });
    expect(record).toHaveBeenCalledWith({
      userId: "user-1",
      correlationId: "cid-1",
      ip: "203.0.113.1",
      userAgent: "Mozilla/5.0",
      outcome: "success",
    });
  });

  it("recordBadRequest writes failure_bad_request with userId=null", async () => {
    const { auditor, record } = await buildAuditor();
    await auditor.recordBadRequest(context);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure_bad_request",
        userId: null,
      }),
    );
  });

  it("recordInternalFailure writes failure_internal with userId=null", async () => {
    const { auditor, record } = await buildAuditor();
    await auditor.recordInternalFailure(context);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure_internal",
        userId: null,
      }),
    );
  });

  it("recordRateLimited writes failure_rate_limited with userId=null", async () => {
    const { auditor, record } = await buildAuditor();
    await auditor.recordRateLimited(context);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure_rate_limited",
        userId: null,
      }),
    );
  });

  const reasonOutcomeCases: Array<{
    reason: IdTokenVerificationReason;
    outcome: SignInOutcome;
  }> = [
    { reason: "signature", outcome: "failure_token_signature" },
    { reason: "expired", outcome: "failure_token_expired" },
    { reason: "issuer", outcome: "failure_token_issuer" },
    { reason: "audience", outcome: "failure_token_audience" },
    { reason: "nonce_mismatch", outcome: "failure_nonce_mismatch" },
    { reason: "malformed", outcome: "failure_token_malformed" },
  ];

  for (const { reason, outcome } of reasonOutcomeCases) {
    it(`recordVerificationFailure maps "${reason}" → "${outcome}"`, async () => {
      const { auditor, record } = await buildAuditor();
      await auditor.recordVerificationFailure({ ...context, reason });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome, userId: null }),
      );
    });
  }

  it("swallows persistence errors so a failed audit write does not break sign-in", async () => {
    const { auditor } = await buildAuditor({
      record: jest.fn().mockRejectedValue(new Error("db is down")),
    });

    await expect(
      auditor.recordSuccess({ ...context, userId: "user-1" }),
    ).resolves.toBeUndefined();
  });

  describe("metrics emission", () => {
    it("recordSuccess increments the success counter", async () => {
      const { auditor, recordSignInOutcome } = await buildAuditor();
      await auditor.recordSuccess({ ...context, userId: "user-1" });
      expect(recordSignInOutcome).toHaveBeenCalledWith("success");
    });

    it("recordVerificationFailure increments the per-outcome counter", async () => {
      const { auditor, recordSignInOutcome } = await buildAuditor();
      await auditor.recordVerificationFailure({
        ...context,
        reason: "signature",
      });
      expect(recordSignInOutcome).toHaveBeenCalledWith(
        "failure_token_signature",
      );
    });

    it("recordRateLimited increments both the outcome counter and rate_limiter_blocks_total", async () => {
      const { auditor, recordSignInOutcome, recordRateLimiterBlock } =
        await buildAuditor();
      await auditor.recordRateLimited(context);
      expect(recordSignInOutcome).toHaveBeenCalledWith("failure_rate_limited");
      expect(recordRateLimiterBlock).toHaveBeenCalledTimes(1);
    });

    it("recordBadRequest increments failure_bad_request", async () => {
      const { auditor, recordSignInOutcome } = await buildAuditor();
      await auditor.recordBadRequest(context);
      expect(recordSignInOutcome).toHaveBeenCalledWith("failure_bad_request");
    });

    it("recordInternalFailure increments failure_internal", async () => {
      const { auditor, recordSignInOutcome } = await buildAuditor();
      await auditor.recordInternalFailure(context);
      expect(recordSignInOutcome).toHaveBeenCalledWith("failure_internal");
    });

    it("still emits the metric when the audit write fails", async () => {
      const { auditor, recordSignInOutcome } = await buildAuditor({
        record: jest.fn().mockRejectedValue(new Error("db is down")),
      });
      await auditor.recordSuccess({ ...context, userId: "user-1" });
      expect(recordSignInOutcome).toHaveBeenCalledWith("success");
    });
  });
});
