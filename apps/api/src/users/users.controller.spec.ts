import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Session } from "../auth/entities/session.entity";
import { User } from "../auth/entities/user.entity";
import { SessionsService } from "../auth/services/sessions.service";
import { UsersService } from "../auth/services/users.service";
import { UsersController } from "./users.controller";

function buildController(
  overrides: {
    users?: Partial<UsersService>;
    sessions?: Partial<SessionsService>;
  } = {},
): {
  controller: UsersController;
  users: UsersService;
  sessions: SessionsService;
} {
  const users = {
    findById: jest.fn(),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
    ...overrides.users,
  } as unknown as UsersService;
  const sessions = {
    listActiveForUser: jest.fn(),
    revoke: jest.fn(),
    findById: jest.fn(),
    ...overrides.sessions,
  } as unknown as SessionsService;
  return {
    controller: new UsersController(users, sessions),
    users,
    sessions,
  };
}

describe("UsersController GET /users/me", () => {
  it("returns the principal's profile", async () => {
    const user = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      avatarUrl: "https://example.com/a.png",
    } as User;
    const { controller } = buildController({
      users: { findById: jest.fn().mockResolvedValue(user) },
    });
    const req = { principal: { userId: "user-1", sessionId: "s" } } as never;

    const result = await controller.me(req);

    expect(result).toEqual({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("returns avatarUrl null when not set", async () => {
    const user = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      avatarUrl: null,
    } as User;
    const { controller } = buildController({
      users: { findById: jest.fn().mockResolvedValue(user) },
    });
    const req = { principal: { userId: "user-1", sessionId: "s" } } as never;

    const result = await controller.me(req);

    expect(result.avatarUrl).toBeNull();
  });

  it("throws when principal references a missing user", async () => {
    const { controller } = buildController({
      users: { findById: jest.fn().mockResolvedValue(null) },
    });
    const req = {
      principal: { userId: "ghost", sessionId: "s" },
    } as never;

    await expect(controller.me(req)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("UsersController GET /users/me/sessions", () => {
  it("returns only active sessions for the principal, flagging the current one", async () => {
    const now = Date.now();
    const sessionA = {
      id: "session-A",
      userId: "user-1",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      lastActiveAt: new Date(now - 1_000),
    } as Session;
    const sessionB = {
      id: "session-B",
      userId: "user-1",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      lastActiveAt: new Date(now - 60_000),
    } as Session;
    const listActiveForUser = jest.fn().mockResolvedValue([sessionA, sessionB]);
    const { controller } = buildController({ sessions: { listActiveForUser } });
    const req = {
      principal: { userId: "user-1", sessionId: "session-B" },
    } as never;

    const result = await controller.listSessions(req);

    expect(listActiveForUser).toHaveBeenCalledWith("user-1");
    expect(result).toEqual([
      {
        id: "session-A",
        deviceLabel: "Chrome on macOS",
        lastActiveAt: sessionA.lastActiveAt.toISOString(),
        isCurrent: false,
      },
      {
        id: "session-B",
        deviceLabel: "Safari on iOS",
        lastActiveAt: sessionB.lastActiveAt.toISOString(),
        isCurrent: true,
      },
    ]);
  });

  it("falls back to 'Unknown device' when user agent is missing", async () => {
    const session = {
      id: "session-A",
      userId: "user-1",
      userAgent: null,
      lastActiveAt: new Date(),
    } as Session;
    const listActiveForUser = jest.fn().mockResolvedValue([session]);
    const { controller } = buildController({ sessions: { listActiveForUser } });
    const req = {
      principal: { userId: "user-1", sessionId: "session-A" },
    } as never;

    const result = await controller.listSessions(req);

    expect(result[0]?.deviceLabel).toBe("Unknown device");
    expect(result[0]?.isCurrent).toBe(true);
  });
});

describe("UsersController DELETE /users/me", () => {
  it("rejects when confirm flag is missing or not true", async () => {
    const deleteAccount = jest.fn();
    const { controller } = buildController({
      users: { deleteAccount: deleteAccount as never },
    });
    const req = { principal: { userId: "user-1", sessionId: "s" } } as never;
    const res = { setHeader: jest.fn() } as never;

    await expect(
      controller.deleteMe(req, res, {} as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.deleteMe(req, res, { confirm: false } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.deleteMe(req, res, { confirm: "true" as never } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account and clears the session cookie on confirm:true", async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    const { controller } = buildController({
      users: { deleteAccount: deleteAccount as never },
    });
    const setHeader = jest.fn();
    const req = {
      principal: { userId: "user-1", sessionId: "s" },
    } as never;
    const res = { setHeader } as never;

    await controller.deleteMe(req, res, { confirm: true });

    expect(deleteAccount).toHaveBeenCalledWith("user-1");
    const setCookieCalls = setHeader.mock.calls.filter(
      ([name]) => name === "Set-Cookie",
    );
    expect(setCookieCalls).toHaveLength(1);
    const cookieValue = setCookieCalls[0][1] as string;
    expect(cookieValue).toMatch(/^fortuna_session=/);
    expect(cookieValue).toContain("Max-Age=0");
  });
});

describe("UsersController DELETE /users/me/sessions/:id", () => {
  it("refuses to revoke the current session with 400", async () => {
    const revoke = jest.fn();
    const findById = jest.fn();
    const { controller } = buildController({
      sessions: { revoke, findById },
    });
    const req = {
      principal: { userId: "user-1", sessionId: "session-current" },
    } as never;

    await expect(
      controller.revokeSession(req, "session-current"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(revoke).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
  });

  it("returns 404 when the session does not exist", async () => {
    const findById = jest.fn().mockResolvedValue(null);
    const revoke = jest.fn();
    const { controller } = buildController({
      sessions: { findById, revoke },
    });
    const req = {
      principal: { userId: "user-1", sessionId: "session-current" },
    } as never;

    await expect(
      controller.revokeSession(req, "session-other"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("returns 404 (not 403) when the session belongs to another user", async () => {
    const otherUserSession = {
      id: "session-other",
      userId: "user-attacker",
    } as Session;
    const findById = jest.fn().mockResolvedValue(otherUserSession);
    const revoke = jest.fn();
    const { controller } = buildController({
      sessions: { findById, revoke },
    });
    const req = {
      principal: { userId: "user-1", sessionId: "session-current" },
    } as never;

    await expect(
      controller.revokeSession(req, "session-other"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("revokes a non-current session owned by the principal", async () => {
    const ownedSession = {
      id: "session-other",
      userId: "user-1",
    } as Session;
    const findById = jest.fn().mockResolvedValue(ownedSession);
    const revoke = jest.fn().mockResolvedValue(undefined);
    const { controller } = buildController({
      sessions: { findById, revoke },
    });
    const req = {
      principal: { userId: "user-1", sessionId: "session-current" },
    } as never;

    await expect(
      controller.revokeSession(req, "session-other"),
    ).resolves.toBeUndefined();
    expect(revoke).toHaveBeenCalledWith("session-other");
  });
});
