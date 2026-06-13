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
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { CategoryDto } from "../dto/category.dto";
import {
  CategoriesService,
  type CategoryResponse,
} from "../services/categories.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @UseGuards(SessionGuard)
  @Post()
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: CategoryDto,
  ): Promise<{ category: CategoryResponse }> {
    const principal = requirePrincipal(req);
    const category = await this.categories.create(principal.userId, body.name);
    return { category };
  }

  @UseGuards(SessionGuard)
  @Get()
  async list(
    @Req() req: AuthedRequest,
  ): Promise<{ items: CategoryResponse[] }> {
    const principal = requirePrincipal(req);
    const items = await this.categories.list(principal.userId);
    return { items };
  }

  @UseGuards(SessionGuard)
  @Patch(":id")
  async rename(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: CategoryDto,
  ): Promise<{ category: CategoryResponse }> {
    const principal = requirePrincipal(req);
    const category = await this.categories.rename(
      principal.userId,
      id,
      body.name,
    );
    return { category };
  }

  @UseGuards(SessionGuard)
  @Delete(":id")
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const principal = requirePrincipal(req);
    await this.categories.remove(principal.userId, id);
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
