import { createHash } from "node:crypto";
import { SESSION_DURATION_MS } from "../cookies/session-cookie";
import { Session } from "../entities/session.entity";
import { SessionsService, SLIDE_THROTTLE_MS } from "./sessions.service";

type RepoMock = {
  save: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
};

function buildRepo(): RepoMock {
  return {
    save: jest.fn(async (entity: Partial<Session>) => entity as Session),
    findOne: jest.fn(),
    update: jest.fn(async () => undefined),
  };
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

describe("SessionsService", () => {
  describe("mint", () => {
    it("persists only the SHA-256 hash and never the raw token", async () => {
      const repo = buildRepo();
      const service = new SessionsService(repo as never);

      const result = await service.mint({
        userId: "user-1",
        userAgent: "Mozilla",
        ip: "1.2.3.4",
      });

      expect(result.rawToken).toEqual(expect.any(String));
      expect(result.rawToken.length).toBeGreaterThan(20);

      expect(repo.save).toHaveBeenCalledTimes(1);
      const persisted = repo.save.mock.calls[0][0] as Partial<Session>;
      expect(persisted.tokenHash).toBe(sha256Hex(result.rawToken));
      // raw token must never appear in the saved entity
      expect(JSON.stringify(persisted)).not.toContain(result.rawToken);
      expect(persisted.userId).toBe("user-1");
      expect(persisted.userAgent).toBe("Mozilla");
      expect(persisted.ipAtCreation).toBe("1.2.3.4");
    });

    it("sets a 30-day expiry from now", async () => {
      const repo = buildRepo();
      const service = new SessionsService(repo as never);
      const before = Date.now();

      const { session } = await service.mint({
        userId: "user-1",
        userAgent: null,
        ip: null,
      });

      const after = Date.now();
      const expiresAt = session.expiresAt.getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(
        before + SESSION_DURATION_MS - 10,
      );
      expect(expiresAt).toBeLessThanOrEqual(after + SESSION_DURATION_MS + 10);
    });

    it("produces a different token each call", async () => {
      const repo = buildRepo();
      const service = new SessionsService(repo as never);

      const a = await service.mint({ userId: "u", userAgent: null, ip: null });
      const b = await service.mint({ userId: "u", userAgent: null, ip: null });

      expect(a.rawToken).not.toEqual(b.rawToken);
    });
  });

  describe("findActiveByRawToken", () => {
    it("returns null when no session matches the hash", async () => {
      const repo = buildRepo();
      repo.findOne.mockResolvedValue(null);
      const service = new SessionsService(repo as never);

      const found = await service.findActiveByRawToken("nope");

      expect(found).toBeNull();
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tokenHash: sha256Hex("nope") },
      });
    });

    it("returns null when the session is revoked", async () => {
      const repo = buildRepo();
      repo.findOne.mockResolvedValue({
        id: "s",
        userId: "u",
        tokenHash: sha256Hex("tkn"),
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      } as Session);
      const service = new SessionsService(repo as never);

      expect(await service.findActiveByRawToken("tkn")).toBeNull();
    });

    it("returns null when the session has expired", async () => {
      const repo = buildRepo();
      repo.findOne.mockResolvedValue({
        id: "s",
        userId: "u",
        tokenHash: sha256Hex("tkn"),
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      } as Session);
      const service = new SessionsService(repo as never);

      expect(await service.findActiveByRawToken("tkn")).toBeNull();
    });

    it("returns the session when active", async () => {
      const repo = buildRepo();
      const session = {
        id: "s",
        userId: "u",
        tokenHash: sha256Hex("tkn"),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      } as Session;
      repo.findOne.mockResolvedValue(session);
      const service = new SessionsService(repo as never);

      expect(await service.findActiveByRawToken("tkn")).toBe(session);
    });
  });

  describe("revoke", () => {
    it("sets revoked_at on the session row", async () => {
      const repo = buildRepo();
      const service = new SessionsService(repo as never);
      const before = Date.now();

      await service.revoke("session-1");

      expect(repo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = repo.update.mock.calls[0];
      expect(where).toEqual({ id: "session-1" });
      expect(patch.revokedAt).toBeInstanceOf(Date);
      expect((patch.revokedAt as Date).getTime()).toBeGreaterThanOrEqual(
        before,
      );
    });
  });

  describe("maybeSlide", () => {
    it("does not write when last_active_at is within the throttle window", async () => {
      const repo = buildRepo();
      const service = new SessionsService(repo as never);
      const session = {
        id: "s",
        userId: "u",
        lastActiveAt: new Date(Date.now() - 60_000), // 1 min ago
        expiresAt: new Date(Date.now() + 10_000),
      } as Session;

      await service.maybeSlide(session);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("slides last_active_at + expires_at when stale", async () => {
      const repo = buildRepo();
      const service = new SessionsService(repo as never);
      const before = Date.now();
      const session = {
        id: "s",
        userId: "u",
        lastActiveAt: new Date(Date.now() - SLIDE_THROTTLE_MS - 1_000),
        expiresAt: new Date(Date.now() + 1_000),
      } as Session;

      await service.maybeSlide(session);

      expect(repo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = repo.update.mock.calls[0];
      expect(where).toEqual({ id: "s" });
      expect(patch.lastActiveAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(patch.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + SESSION_DURATION_MS - 10,
      );
    });
  });
});
