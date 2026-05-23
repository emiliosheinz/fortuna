import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/guards/session.guard";
import { SessionsService } from "../auth/services/sessions.service";
import { UsersService } from "../auth/services/users.service";
import { deriveDeviceLabel } from "../auth/sessions/device-label";

/** Response body for `GET /users/me`. Mirrors the user's Google profile. */
export interface MeResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Single item in the `GET /users/me/sessions` response. */
export interface SessionListItem {
  id: string;
  deviceLabel: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

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

  /**
   * List the principal's active sessions, newest active first, with a
   * derived device label and an `isCurrent` flag pointing at the session
   * carrying this request.
   */
  @UseGuards(SessionGuard)
  @Get("me/sessions")
  async listSessions(@Req() req: AuthedRequest): Promise<SessionListItem[]> {
    const principal = req.principal;
    if (!principal) throw new NotFoundException();

    const sessions = await this.sessions.listActiveForUser(principal.userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: deriveDeviceLabel(s.userAgent),
      lastActiveAt: s.lastActiveAt.toISOString(),
      isCurrent: s.id === principal.sessionId,
    }));
  }

  /**
   * Revoke one of the principal's non-current sessions.
   *
   * Refuses to revoke the current session (use `DELETE /auth/session`
   * instead). Returns 404 — never 403 — when the session is not owned by
   * the principal, to avoid leaking session-id existence.
   */
  @UseGuards(SessionGuard)
  @Delete("me/sessions/:id")
  @HttpCode(204)
  async revokeSession(
    @Req() req: AuthedRequest,
    @Param("id") sessionId: string,
  ): Promise<void> {
    const principal = req.principal;
    if (!principal) throw new NotFoundException();

    if (sessionId === principal.sessionId) {
      throw new BadRequestException(
        "Cannot revoke the current session; sign out instead.",
      );
    }

    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== principal.userId) {
      throw new NotFoundException();
    }

    await this.sessions.revoke(session.id);
  }
}
