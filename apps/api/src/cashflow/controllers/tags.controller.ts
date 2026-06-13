import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { TagDto } from "../dto/tag.dto";
import { TagDrillDownQueryDto } from "../dto/tag-drill-down-query.dto";
import {
  TagDrillDownResponse,
  TagDrillDownService,
} from "../services/tag-drill-down.service";
import { type TagResponse, TagsService } from "../services/tags.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("tags")
export class TagsController {
  constructor(
    private readonly tags: TagsService,
    private readonly drillDown: TagDrillDownService,
  ) {}

  @UseGuards(SessionGuard)
  @Post()
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: TagDto,
  ): Promise<{ tag: TagResponse }> {
    const principal = requirePrincipal(req);
    const tag = await this.tags.create(principal.userId, body.name);
    return { tag };
  }

  @UseGuards(SessionGuard)
  @Get()
  async list(@Req() req: AuthedRequest): Promise<{ items: TagResponse[] }> {
    const principal = requirePrincipal(req);
    const items = await this.tags.list(principal.userId);
    return { items };
  }

  @UseGuards(SessionGuard)
  @Patch(":id")
  async rename(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: TagDto,
  ): Promise<{ tag: TagResponse }> {
    const principal = requirePrincipal(req);
    const tag = await this.tags.rename(principal.userId, id, body.name);
    return { tag };
  }

  @UseGuards(SessionGuard)
  @Delete(":id")
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const principal = requirePrincipal(req);
    await this.tags.remove(principal.userId, id);
  }

  @UseGuards(SessionGuard)
  @Get(":id/drill-down")
  async getDrillDown(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: TagDrillDownQueryDto,
  ): Promise<TagDrillDownResponse> {
    const principal = requirePrincipal(req);
    return this.drillDown.getForUser(principal.userId, id, {
      from: query.from,
      to: query.to,
    });
  }
}

function requirePrincipal(req: AuthedRequest): {
  userId: string;
  sessionId: string;
} {
  if (!req.principal) {
    throw new UnauthorizedException();
  }
  return req.principal;
}
