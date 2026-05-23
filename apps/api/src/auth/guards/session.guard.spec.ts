import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { Session } from "../entities/session.entity";
import { SessionsService } from "../services/sessions.service";
import { SessionGuard } from "./session.guard";

function makeContext(cookieHeader: string | undefined): {
  ctx: ExecutionContext;
  request: { headers: Record<string, string | undefined> } & Record<
    string,
    unknown
  >;
} {
  const request = {
    headers: { cookie: cookieHeader },
  } as { headers: Record<string, string | undefined> } & Record<
    string,
    unknown
  >;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function makeService(overrides: Partial<SessionsService>): SessionsService {
  return {
    findActiveByRawToken: jest.fn().mockResolvedValue(null),
    maybeSlide: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SessionsService;
}

describe("SessionGuard", () => {
  it("rejects when no cookie present", async () => {
    const service = makeService({});
    const guard = new SessionGuard(service);
    const { ctx } = makeContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.findActiveByRawToken).not.toHaveBeenCalled();
  });

  it("rejects when session lookup returns null", async () => {
    const service = makeService({
      findActiveByRawToken: jest.fn().mockResolvedValue(null),
    });
    const guard = new SessionGuard(service);
    const { ctx } = makeContext("fortuna_session=bad-token");

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("attaches principal to request when session is active and slides", async () => {
    const session = {
      id: "session-1",
      userId: "user-1",
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    } as Session;
    const service = makeService({
      findActiveByRawToken: jest.fn().mockResolvedValue(session),
      maybeSlide: jest.fn().mockResolvedValue(undefined),
    });
    const guard = new SessionGuard(service);
    const { ctx, request } = makeContext("fortuna_session=opaque-good");

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(service.findActiveByRawToken).toHaveBeenCalledWith("opaque-good");
    expect(service.maybeSlide).toHaveBeenCalledWith(session);
    expect((request as { principal?: unknown }).principal).toEqual({
      userId: "user-1",
      sessionId: "session-1",
    });
  });

  it("does not leak internal failure detail", async () => {
    const service = makeService({});
    const guard = new SessionGuard(service);
    const { ctx } = makeContext("other=foo");

    let caught: unknown;
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    const message = (caught as UnauthorizedException).getResponse();
    expect(JSON.stringify(message).toLowerCase()).not.toContain("revoked");
    expect(JSON.stringify(message).toLowerCase()).not.toContain("expired");
  });
});
