import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { GoogleSignInDto } from "../dto/google-sign-in.dto";
import type { Session } from "../entities/session.entity";
import type { User } from "../entities/user.entity";
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
    "recordSuccess" | "recordVerificationFailure" | "recordInternalFailure"
  > = {
    recordSuccess: stubs.recordSuccess,
    recordVerificationFailure: stubs.recordVerificationFailure,
    recordInternalFailure: stubs.recordInternalFailure,
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: GoogleIdTokenVerifier, useValue: verifierStub },
      { provide: UsersService, useValue: usersStub },
      { provide: SessionsService, useValue: sessionsStub },
      { provide: DeviceFingerprintsService, useValue: fingerprintsStub },
      { provide: SignInAuditor, useValue: auditorStub },
    ],
  }).compile();

  return { service: moduleRef.get(AuthService), ...stubs };
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
