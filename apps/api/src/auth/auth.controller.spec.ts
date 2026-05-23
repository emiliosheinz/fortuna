import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { AuthController, type GoogleSignInDto } from "./auth.controller";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
} from "./services/google-id-token-verifier";
import { SessionsService } from "./services/sessions.service";
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
  } = {},
): AuthController {
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
    ...overrides.sessions,
  } as unknown as SessionsService;
  return new AuthController(verifier, users, sessions);
}

describe("AuthController DELETE /auth/session", () => {
  it("revokes the principal's session and sets a clear-session-cookie header", async () => {
    const revoke = jest.fn().mockResolvedValue(undefined);
    const controller = buildController({ sessions: { revoke } });

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

  it("rejects when body is missing fields", async () => {
    const controller = buildController();
    const req = new FakeRequest();

    await expect(
      controller.googleSignIn(
        { idToken: "", nonce: "" } as GoogleSignInDto,
        req as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns 401 on token verification failure", async () => {
    const controller = buildController({
      verifier: {
        verify: jest
          .fn()
          .mockRejectedValue(new IdTokenVerificationError("signature")),
      },
    });
    const req = new FakeRequest();

    await expect(
      controller.googleSignIn(validBody, req as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("verifies token, upserts user, mints session, returns sessionToken + expiresAt", async () => {
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
    const controller = buildController({ verifier, users, sessions });
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
  });
});
