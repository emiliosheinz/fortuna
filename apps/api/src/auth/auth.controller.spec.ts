import {
  BadRequestException,
  type HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthController, type GoogleSignInDto } from "./auth.controller";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
  type IdTokenVerificationReason,
} from "./services/google-id-token-verifier";
import { SessionsService } from "./services/sessions.service";
import { SignInEventsService } from "./services/sign-in-events.service";
import { UsersService } from "./services/users.service";

class FakeRequest {
  constructor(
    public readonly ip: string | null = "203.0.113.5",
    public readonly headers: Record<string, string | undefined> = {
      "user-agent": "Mozilla/5.0",
    },
  ) {}
}

function buildController(
  overrides: {
    verifier?: Partial<GoogleIdTokenVerifier>;
    users?: Partial<UsersService>;
    sessions?: Partial<SessionsService>;
    signInEvents?: Partial<SignInEventsService>;
  } = {},
): {
  controller: AuthController;
  verifier: GoogleIdTokenVerifier;
  users: UsersService;
  sessions: SessionsService;
  signInEvents: SignInEventsService;
} {
  const verifier = {
    verify: jest.fn(),
    ...overrides.verifier,
  } as unknown as GoogleIdTokenVerifier;
  const users = {
    upsertFromGoogleIdentity: jest.fn(),
    ...overrides.users,
  } as unknown as UsersService;
  const sessions = {
    mint: jest.fn(),
    revoke: jest.fn(),
    ...overrides.sessions,
  } as unknown as SessionsService;
  const signInEvents = {
    record: jest.fn().mockResolvedValue(undefined),
    ...overrides.signInEvents,
  } as unknown as SignInEventsService;
  return {
    controller: new AuthController(verifier, users, sessions, signInEvents),
    verifier,
    users,
    sessions,
    signInEvents,
  };
}

describe("AuthController DELETE /auth/session", () => {
  it("revokes the principal's session and sets a clear-session-cookie header", async () => {
    const revoke = jest.fn().mockResolvedValue(undefined);
    const { controller } = buildController({ sessions: { revoke } });

    const setHeader = jest.fn();
    const req = { principal: { userId: "user-1", sessionId: "session-1" } };

    await controller.signOut(req as never, { setHeader } as never);

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
});

describe("AuthController POST /auth/google", () => {
  const validBody: GoogleSignInDto = {
    idToken: "valid.id.token",
    nonce: "the-nonce",
  };

  it("rejects when body is missing fields and records failure_bad_request", async () => {
    const { controller, signInEvents } = buildController();
    const req = new FakeRequest();

    await expect(
      controller.googleSignIn(
        { idToken: "", nonce: "" } as GoogleSignInDto,
        req as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(signInEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        outcome: "failure_bad_request",
        ip: "203.0.113.5",
        userAgent: "Mozilla/5.0",
        correlationId: expect.any(String),
      }),
    );
  });

  it("returns 401 with correlationId in body on token verification failure", async () => {
    const { controller, signInEvents } = buildController({
      verifier: {
        verify: jest
          .fn()
          .mockRejectedValue(new IdTokenVerificationError("signature")),
      },
    });
    const req = new FakeRequest();

    const err = await controller
      .googleSignIn(validBody, req as never)
      .catch((e: HttpException) => e);

    expect(err).toBeInstanceOf(UnauthorizedException);
    const body = (err as HttpException).getResponse() as {
      correlationId?: string;
    };
    expect(body.correlationId).toEqual(expect.any(String));
    expect(signInEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure_token_signature",
        userId: null,
        correlationId: body.correlationId,
      }),
    );
  });

  const verificationReasonCases: Array<{
    reason: IdTokenVerificationReason;
    outcome: string;
  }> = [
    { reason: "signature", outcome: "failure_token_signature" },
    { reason: "expired", outcome: "failure_token_expired" },
    { reason: "issuer", outcome: "failure_token_issuer" },
    { reason: "audience", outcome: "failure_token_audience" },
    { reason: "nonce_mismatch", outcome: "failure_nonce_mismatch" },
    { reason: "malformed", outcome: "failure_token_malformed" },
  ];

  for (const { reason, outcome } of verificationReasonCases) {
    it(`maps verification reason "${reason}" to outcome "${outcome}"`, async () => {
      const { controller, signInEvents } = buildController({
        verifier: {
          verify: jest
            .fn()
            .mockRejectedValue(new IdTokenVerificationError(reason)),
        },
      });
      const req = new FakeRequest();

      await controller
        .googleSignIn(validBody, req as never)
        .catch(() => undefined);

      expect(signInEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome }),
      );
    });
  }

  it("records failure_internal when verifier throws an unknown error", async () => {
    const { controller, signInEvents } = buildController({
      verifier: { verify: jest.fn().mockRejectedValue(new Error("boom")) },
    });
    const req = new FakeRequest();

    await expect(
      controller.googleSignIn(validBody, req as never),
    ).rejects.toBeInstanceOf(Error);
    expect(signInEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failure_internal" }),
    );
  });

  it("verifies token, upserts user, mints session, records success event", async () => {
    const user = { id: "user-1" } as User;
    const expiresAt = new Date(Date.now() + 1000);
    const session = {
      id: "session-1",
      userId: "user-1",
      expiresAt,
    } as Session;
    const verifier = {
      verify: jest.fn().mockResolvedValue({
        sub: "g-sub",
        email: "u@example.com",
        name: "U",
      }),
    };
    const users = {
      upsertFromGoogleIdentity: jest.fn().mockResolvedValue(user),
    };
    const sessions = {
      mint: jest.fn().mockResolvedValue({ rawToken: "raw-token-xyz", session }),
    };
    const { controller, signInEvents } = buildController({
      verifier,
      users,
      sessions,
    });
    const req = new FakeRequest();

    const result = await controller.googleSignIn(validBody, req as never);

    expect(verifier.verify).toHaveBeenCalledWith("valid.id.token", "the-nonce");
    expect(users.upsertFromGoogleIdentity).toHaveBeenCalledWith({
      sub: "g-sub",
      email: "u@example.com",
      name: "U",
    });
    expect(sessions.mint).toHaveBeenCalledWith({
      userId: "user-1",
      userAgent: "Mozilla/5.0",
      ip: "203.0.113.5",
    });
    expect(result).toEqual({
      sessionToken: "raw-token-xyz",
      expiresAt: expiresAt.toISOString(),
    });
    expect(signInEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        outcome: "success",
        ip: "203.0.113.5",
        userAgent: "Mozilla/5.0",
        correlationId: expect.any(String),
      }),
    );
  });
});
