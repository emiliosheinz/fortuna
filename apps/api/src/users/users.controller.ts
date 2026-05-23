import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/guards/session.guard";
import { UsersService } from "../auth/services/users.service";

/** Response body for `GET /users/me`. Mirrors the user's Google profile. */
export interface MeResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Return the signed-in user's profile.
   *
   * Identity comes from the request principal that the {@link SessionGuard}
   * attached — never from a client-supplied id.
   */
  @UseGuards(SessionGuard)
  @Get("me")
  async me(@Req() req: AuthedRequest): Promise<MeResponse> {
    const principal = req.principal;
    if (!principal) {
      throw new NotFoundException();
    }
    const user = await this.users.findById(principal.userId);
    if (!user) {
      throw new NotFoundException();
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }
}
