import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import { MetricsService } from "../metrics/metrics.service";
import { AuthController } from "./auth.controller";
import type { GoogleSignInDto } from "./dto/google-sign-in.dto";
import { BadRequestAuditFilter } from "./filters/bad-request-audit.filter";
import { AuthService } from "./services/auth.service";
import { SessionsService } from "./services/sessions.service";
import { SignInAuditor } from "./services/sign-in-auditor";
import { SignInEventsService } from "./services/sign-in-events.service";

/**
 * Build a minimal Express-shaped object for the unit test. Express's types
 * have ~hundreds of methods we don't touch in a single handler call; the cast
 * is the unavoidable seam between Nest's `@Req()` / `@Res()` signatures and a
 * unit-test double. Confined to this helper so the rest of the spec stays
 * cast-free.
 */
function fakeResponse(): { res: Response; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  return { res, setHeader };
}

function fakeRequest(
  overrides: {
    ip?: string | null;
    headers?: Record<string, string | undefined>;
    principal?: { userId: string; sessionId: string };
  } = {},
): Request {
  const base = {
    ip: overrides.ip ?? "203.0.113.5",
    headers: overrides.headers ?? {},
    principal: overrides.principal,
  };
  return base as unknown as Request;
}

interface ControllerStubs {
  signInWithGoogle: jest.Mock;
  revoke: jest.Mock;
  recordSessionRevocation: jest.Mock;
  recordSignInOutcome: jest.Mock;
  recordRateLimiterBlock: jest.Mock;
}

async function buildController(
  overrides: Partial<ControllerStubs> = {},
): Promise<{ controller: AuthController } & ControllerStubs> {
  const stubs: ControllerStubs = {
    signInWithGoogle: jest.fn(),
    revoke: jest.fn().mockResolvedValue(undefined),
    recordSessionRevocation: jest.fn(),
    recordSignInOutcome: jest.fn(),
    recordRateLimiterBlock: jest.fn(),
    ...overrides,
  };

  const authServiceStub: Pick<AuthService, "signInWithGoogle"> = {
    signInWithGoogle: stubs.signInWithGoogle,
  };
  const sessionsStub: Pick<SessionsService, "revoke"> = {
    revoke: stubs.revoke,
  };
  const eventsStub: Pick<SignInEventsService, "record"> = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const metricsStub: Pick<
    MetricsService,
    "recordSessionRevocation" | "recordSignInOutcome" | "recordRateLimiterBlock"
  > = {
    recordSessionRevocation: stubs.recordSessionRevocation,
    recordSignInOutcome: stubs.recordSignInOutcome,
    recordRateLimiterBlock: stubs.recordRateLimiterBlock,
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: authServiceStub },
      { provide: SessionsService, useValue: sessionsStub },
      { provide: SignInEventsService, useValue: eventsStub },
      { provide: MetricsService, useValue: metricsStub },
      SignInAuditor,
      BadRequestAuditFilter,
    ],
  }).compile();

  return { controller: moduleRef.get(AuthController), ...stubs };
}

describe("AuthController POST /auth/google", () => {
  it("delegates to AuthService.signInWithGoogle with the dto and request metadata", async () => {
    const { controller, signInWithGoogle } = await buildController({
      signInWithGoogle: jest.fn().mockResolvedValue({
        sessionToken: "tok",
        expiresAt: "2026-06-01T00:00:00.000Z",
      }),
    });

    const dto: GoogleSignInDto = {
      idToken: "valid.id.token",
      nonce: "the-nonce",
    };
    const req = fakeRequest({ headers: { "user-agent": "Mozilla/5.0" } });

    const result = await controller.googleSignIn(dto, req);

    expect(signInWithGoogle).toHaveBeenCalledWith(dto, {
      ip: "203.0.113.5",
      userAgent: "Mozilla/5.0",
    });
    expect(result).toEqual({
      sessionToken: "tok",
      expiresAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("passes userAgent=null when the header is absent", async () => {
    const { controller, signInWithGoogle } = await buildController({
      signInWithGoogle: jest.fn().mockResolvedValue({
        sessionToken: "tok",
        expiresAt: "2026-06-01T00:00:00.000Z",
      }),
    });

    await controller.googleSignIn(
      { idToken: "t", nonce: "n" } satisfies GoogleSignInDto,
      fakeRequest(),
    );

    expect(signInWithGoogle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userAgent: null }),
    );
  });
});

describe("AuthController DELETE /auth/session", () => {
  it("revokes the principal's session and sets the clear-session-cookie header", async () => {
    const { controller, revoke } = await buildController();
    const { res, setHeader } = fakeResponse();
    const req = fakeRequest({
      principal: { userId: "user-1", sessionId: "session-1" },
    });

    await controller.signOut(req, res);

    expect(revoke).toHaveBeenCalledWith("session-1");
    const setCookieCalls = setHeader.mock.calls.filter(
      ([name]) => name === "Set-Cookie",
    );
    expect(setCookieCalls).toHaveLength(1);
    const cookieValue = setCookieCalls[0][1] as string;
    expect(cookieValue).toMatch(/^fortuna_session=/);
    expect(cookieValue).toContain("Max-Age=0");
    expect(cookieValue).toContain("Path=/");
    expect(cookieValue.toLowerCase()).toContain("httponly");
    expect(cookieValue.toLowerCase()).toContain("samesite=lax");
  });

  it("increments auth_session_revocations_total with reason=user_signout", async () => {
    const { controller, recordSessionRevocation } = await buildController();
    const { res } = fakeResponse();
    const req = fakeRequest({
      principal: { userId: "user-1", sessionId: "session-1" },
    });

    await controller.signOut(req, res);

    expect(recordSessionRevocation).toHaveBeenCalledWith("user_signout");
  });
});
