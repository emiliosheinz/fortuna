import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { generateKeyPair, SignJWT } from "jose";
import type { GoogleSignInDto } from "../dto/google-sign-in.dto";
import type { Session } from "../entities/session.entity";
import type { User } from "../entities/user.entity";
import { SlidingWindowLimiter } from "../rate-limit/sliding-window-limiter";
import { AuthService } from "./auth.service";
import { DeviceFingerprintsService } from "./device-fingerprints.service";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
  type IdTokenVerificationReason,
} from "./google-id-token-verifier";
import { SessionsService } from "./sessions.service";
import { SignInAuditor } from "./sign-in-auditor";
import { UsersService } from "./users.service";

interface AuthServiceStubs {
  verify: jest.Mock;
  upsertFromGoogleIdentity: jest.Mock;
  mint: jest.Mock;
  recordSignIn: jest.Mock;
  recordSuccess: jest.Mock;
  recordVerificationFailure: jest.Mock;
  recordInternalFailure: jest.Mock;
  recordRateLimited: jest.Mock;
  checkIpRate: jest.Mock;
  checkIdentityBackoff: jest.Mock;
  recordIdentityFailure: jest.Mock;
  clearIdentityFailures: jest.Mock;
  isDegraded: jest.Mock;
}

async function buildAuthService(
  overrides: Partial<AuthServiceStubs> = {},
): Promise<{ service: AuthService } & AuthServiceStubs> {
  const stubs: AuthServiceStubs = {
    verify: jest.fn(),
    upsertFromGoogleIdentity: jest.fn(),
    mint: jest.fn(),
    recordSignIn: jest
      .fn()
      .mockResolvedValue({ fingerprintId: null, isNew: false }),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordVerificationFailure: jest.fn().mockResolvedValue(undefined),
    recordInternalFailure: jest.fn().mockResolvedValue(undefined),
    recordRateLimited: jest.fn().mockResolvedValue(undefined),
    checkIpRate: jest
      .fn()
      .mockResolvedValue({ allowed: true, degraded: false }),
    checkIdentityBackoff: jest
      .fn()
      .mockResolvedValue({ allowed: true, degraded: false }),
    recordIdentityFailure: jest.fn().mockResolvedValue(undefined),
    clearIdentityFailures: jest.fn().mockResolvedValue(undefined),
    isDegraded: jest.fn().mockReturnValue(false),
    ...overrides,
  };

  const verifierStub: Pick<GoogleIdTokenVerifier, "verify"> = {
    verify: stubs.verify,
  };
  const usersStub: Pick<UsersService, "upsertFromGoogleIdentity"> = {
    upsertFromGoogleIdentity: stubs.upsertFromGoogleIdentity,
  };
  const sessionsStub: Pick<SessionsService, "mint"> = { mint: stubs.mint };
  const fingerprintsStub: Pick<DeviceFingerprintsService, "recordSignIn"> = {
    recordSignIn: stubs.recordSignIn,
  };
  const auditorStub: Pick<
    SignInAuditor,
    | "recordSuccess"
    | "recordVerificationFailure"
    | "recordInternalFailure"
    | "recordRateLimited"
  > = {
    recordSuccess: stubs.recordSuccess,
    recordVerificationFailure: stubs.recordVerificationFailure,
    recordInternalFailure: stubs.recordInternalFailure,
    recordRateLimited: stubs.recordRateLimited,
  };
  const limiterStub: Pick<
    SlidingWindowLimiter,
    | "checkIpRate"
    | "checkIdentityBackoff"
    | "recordIdentityFailure"
    | "clearIdentityFailures"
    | "isDegraded"
  > = {
    checkIpRate: stubs.checkIpRate,
    checkIdentityBackoff: stubs.checkIdentityBackoff,
    recordIdentityFailure: stubs.recordIdentityFailure,
    clearIdentityFailures: stubs.clearIdentityFailures,
    isDegraded: stubs.isDegraded,
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: GoogleIdTokenVerifier, useValue: verifierStub },
      { provide: UsersService, useValue: usersStub },
      { provide: SessionsService, useValue: sessionsStub },
      { provide: DeviceFingerprintsService, useValue: fingerprintsStub },
      { provide: SignInAuditor, useValue: auditorStub },
      { provide: SlidingWindowLimiter, useValue: limiterStub },
    ],
  }).compile();

  return { service: moduleRef.get(AuthService), ...stubs };
}

let _signKey: CryptoKey | null = null;
async function signableToken(sub: string): Promise<string> {
  if (!_signKey) {
    const pair = await generateKeyPair("RS256");
    _signKey = pair.privateKey;
  }
  return new SignJWT({ nonce: "n" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://accounts.google.com")
    .setAudience("aud")
    .setSubject(sub)
    .setExpirationTime("5m")
    .sign(_signKey);
}

const validDto: GoogleSignInDto = {
  idToken: "valid.id.token",
  nonce: "the-nonce",
};
const meta = { ip: "203.0.113.5", userAgent: "Mozilla/5.0" };

describe("AuthService.signInWithGoogle", () => {
  it("verifies the token, upserts the user, mints a session, and records success", async () => {
    const user = { id: "user-1" } as User;
    const expiresAt = new Date(Date.now() + 1000);
    const session = {
      id: "session-1",
      userId: "user-1",
      expiresAt,
    } as Session;

    const { service, verify, upsertFromGoogleIdentity, mint, recordSuccess } =
      await buildAuthService({
        verify: jest.fn().mockResolvedValue({
          sub: "g-sub",
          email: "u@example.com",
          name: "U",
        }),
        upsertFromGoogleIdentity: jest.fn().mockResolvedValue(user),
        mint: jest
          .fn()
          .mockResolvedValue({ rawToken: "raw-token-xyz", session }),
      });

    const result = await service.signInWithGoogle(validDto, meta);

    expect(verify).toHaveBeenCalledWith("valid.id.token", "the-nonce");
    expect(upsertFromGoogleIdentity).toHaveBeenCalledWith({
      sub: "g-sub",
      email: "u@example.com",
      name: "U",
    });
    expect(mint).toHaveBeenCalledWith({
      userId: "user-1",
      userAgent: "Mozilla/5.0",
      ip: "203.0.113.5",
      deviceFingerprintId: null,
    });
    expect(result).toEqual({
      sessionToken: "raw-token-xyz",
      expiresAt: expiresAt.toISOString(),
    });
    expect(recordSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        ip: "203.0.113.5",
        userAgent: "Mozilla/5.0",
        correlationId: expect.any(String),
      }),
    );
  });

  it("records the device fingerprint and links it to the new session", async () => {
    const user = { id: "user-fp" } as User;
    const session = {
      id: "session-fp",
      userId: "user-fp",
      expiresAt: new Date(Date.now() + 1000),
    } as Session;

    const { service, recordSignIn, mint } = await buildAuthService({
      verify: jest
        .fn()
        .mockResolvedValue({ sub: "g-sub", email: "u@e.com", name: "U" }),
      upsertFromGoogleIdentity: jest.fn().mockResolvedValue(user),
      mint: jest.fn().mockResolvedValue({ rawToken: "raw", session }),
      recordSignIn: jest
        .fn()
        .mockResolvedValue({ fingerprintId: "fp-1", isNew: true }),
    });

    await service.signInWithGoogle(
      { ...validDto, deviceId: "device-cookie-xyz" },
      meta,
    );

    expect(recordSignIn).toHaveBeenCalledWith({
      userId: "user-fp",
      deviceId: "device-cookie-xyz",
      userAgent: "Mozilla/5.0",
    });
    expect(mint).toHaveBeenCalledWith({
      userId: "user-fp",
      userAgent: "Mozilla/5.0",
      ip: "203.0.113.5",
      deviceFingerprintId: "fp-1",
    });
  });

  it("throws UnauthorizedException with correlationId in body on verification failure", async () => {
    const { service, recordVerificationFailure } = await buildAuthService({
      verify: jest
        .fn()
        .mockRejectedValue(new IdTokenVerificationError("signature")),
    });

    const err = await service
      .signInWithGoogle(validDto, meta)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(UnauthorizedException);
    const body = (err as UnauthorizedException).getResponse() as {
      correlationId?: string;
    };
    expect(body.correlationId).toEqual(expect.any(String));
    expect(recordVerificationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "signature",
        correlationId: body.correlationId,
      }),
    );
  });

  const verificationReasonCases: IdTokenVerificationReason[] = [
    "signature",
    "expired",
    "issuer",
    "audience",
    "nonce_mismatch",
    "malformed",
  ];

  for (const reason of verificationReasonCases) {
    it(`forwards verification reason "${reason}" to the auditor`, async () => {
      const { service, recordVerificationFailure } = await buildAuthService({
        verify: jest
          .fn()
          .mockRejectedValue(new IdTokenVerificationError(reason)),
      });

      await service.signInWithGoogle(validDto, meta).catch(() => undefined);

      expect(recordVerificationFailure).toHaveBeenCalledWith(
        expect.objectContaining({ reason }),
      );
    });
  }

  it("records failure_internal when the verifier throws an unknown error", async () => {
    const { service, recordInternalFailure } = await buildAuthService({
      verify: jest.fn().mockRejectedValue(new Error("boom")),
    });

    await expect(service.signInWithGoogle(validDto, meta)).rejects.toThrow(
      "boom",
    );
    expect(recordInternalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
  });
});

describe("AuthService rate limiting", () => {
  it("rejects with 401 + audits failure_rate_limited when the per-IP limiter blocks", async () => {
    const { service, verify, recordRateLimited, checkIpRate } =
      await buildAuthService({
        checkIpRate: jest
          .fn()
          .mockResolvedValue({ allowed: false, retryAfterMs: 12_000 }),
      });

    const err = await service
      .signInWithGoogle(validDto, meta)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(UnauthorizedException);
    const body = (err as UnauthorizedException).getResponse() as {
      correlationId?: string;
    };
    expect(body.correlationId).toEqual(expect.any(String));
    expect(checkIpRate).toHaveBeenCalledWith("203.0.113.5");
    expect(recordRateLimited).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: body.correlationId,
        ip: "203.0.113.5",
      }),
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects with 401 + audits failure_rate_limited when the per-identity limiter blocks", async () => {
    const idToken = await signableToken("identity-blocked");
    const { service, verify, recordRateLimited, checkIdentityBackoff } =
      await buildAuthService({
        checkIdentityBackoff: jest
          .fn()
          .mockResolvedValue({ allowed: false, retryAfterMs: 3_000 }),
      });

    const err = await service
      .signInWithGoogle({ ...validDto, idToken }, meta)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(checkIdentityBackoff).toHaveBeenCalledWith({
      provider: "google",
      subject: "identity-blocked",
    });
    expect(recordRateLimited).toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("skips identity check when the id token cannot be decoded (lets verifier reject)", async () => {
    const { service, verify, checkIdentityBackoff } = await buildAuthService({
      verify: jest
        .fn()
        .mockRejectedValue(new IdTokenVerificationError("malformed")),
    });

    await service
      .signInWithGoogle({ idToken: "not-a-jwt", nonce: "n" }, meta)
      .catch(() => undefined);

    expect(checkIdentityBackoff).not.toHaveBeenCalled();
    expect(verify).toHaveBeenCalled();
  });

  it("records an identity failure when verification fails for a decodable token", async () => {
    const idToken = await signableToken("identity-fails");
    const { service, recordIdentityFailure } = await buildAuthService({
      verify: jest
        .fn()
        .mockRejectedValue(new IdTokenVerificationError("signature")),
    });

    await service
      .signInWithGoogle({ ...validDto, idToken }, meta)
      .catch(() => undefined);

    expect(recordIdentityFailure).toHaveBeenCalledWith({
      provider: "google",
      subject: "identity-fails",
    });
  });

  it("clears identity failures on a successful sign-in", async () => {
    const idToken = await signableToken("identity-success");
    const user = { id: "user-success" } as User;
    const session = {
      id: "s",
      userId: "user-success",
      expiresAt: new Date(Date.now() + 1000),
    } as Session;

    const { service, clearIdentityFailures } = await buildAuthService({
      verify: jest.fn().mockResolvedValue({
        sub: "identity-success",
        email: "u@e.com",
        name: "U",
      }),
      upsertFromGoogleIdentity: jest.fn().mockResolvedValue(user),
      mint: jest.fn().mockResolvedValue({ rawToken: "rt", session }),
    });

    await service.signInWithGoogle({ ...validDto, idToken }, meta);

    expect(clearIdentityFailures).toHaveBeenCalledWith({
      provider: "google",
      subject: "identity-success",
    });
  });
});
