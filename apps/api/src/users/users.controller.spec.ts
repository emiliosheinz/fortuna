import { NotFoundException } from "@nestjs/common";
import { User } from "../auth/entities/user.entity";
import { UsersService } from "../auth/services/users.service";
import { UsersController } from "./users.controller";

function buildController(service: Partial<UsersService>): {
  controller: UsersController;
  service: UsersService;
} {
  const svc = {
    findById: jest.fn(),
    ...service,
  } as unknown as UsersService;
  return { controller: new UsersController(svc), service: svc };
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
      findById: jest.fn().mockResolvedValue(user),
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
      findById: jest.fn().mockResolvedValue(user),
    });
    const req = { principal: { userId: "user-1", sessionId: "s" } } as never;

    const result = await controller.me(req);

    expect(result.avatarUrl).toBeNull();
  });

  it("throws when principal references a missing user", async () => {
    const { controller } = buildController({
      findById: jest.fn().mockResolvedValue(null),
    });
    const req = {
      principal: { userId: "ghost", sessionId: "s" },
    } as never;

    await expect(controller.me(req)).rejects.toBeInstanceOf(NotFoundException);
  });
});
