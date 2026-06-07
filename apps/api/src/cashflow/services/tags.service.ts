import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { type EntityManager, In, QueryFailedError, Repository } from "typeorm";
import { Tag } from "../entities/tag.entity";

export interface TagResponse {
  id: string;
  name: string;
}

const UNIQUE_VIOLATION = "23505";
const UNIQUE_CONSTRAINT = "tags_user_name_uq";

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>,
  ) {}

  async create(userId: string, name: string): Promise<TagResponse> {
    try {
      const saved = await this.tags.save(this.tags.create({ userId, name }));
      return toResponse(saved);
    } catch (err) {
      throw mapUniqueViolation(err, name);
    }
  }

  async list(userId: string): Promise<TagResponse[]> {
    const rows = await this.tags.find({
      where: { userId },
      order: { name: "ASC" },
    });
    return rows.map(toResponse);
  }

  async rename(userId: string, id: string, name: string): Promise<TagResponse> {
    const row = await this.tags.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException("Tag not found");
    }
    row.name = name;
    try {
      const saved = await this.tags.save(row);
      return toResponse(saved);
    } catch (err) {
      throw mapUniqueViolation(err, name);
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.tags.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException("Tag not found");
    }
  }

  /**
   * Resolve a set of tag names to row ids for the given user. Missing names
   * are inserted before resolution so the caller always gets one id per name.
   * The whole operation runs inside the supplied EntityManager so it can be
   * composed inside a wider transaction (e.g. the transaction-capture flow).
   */
  async resolveOrCreateByName(
    manager: EntityManager,
    userId: string,
    names: readonly string[],
  ): Promise<TagResponse[]> {
    const unique = dedupe(names);
    if (unique.length === 0) return [];

    const repo = manager.getRepository(Tag);
    const existing = await repo.find({
      where: { userId, name: In(unique) },
    });
    const existingByName = new Map(existing.map((row) => [row.name, row]));

    const missing = unique.filter((name) => !existingByName.has(name));
    if (missing.length > 0) {
      const created = await repo.save(
        missing.map((name) => repo.create({ userId, name })),
      );
      for (const row of created) {
        existingByName.set(row.name, row);
      }
    }

    return unique.map((name) => {
      const row = existingByName.get(name);
      if (!row) throw new Error(`Failed to resolve tag "${name}"`);
      return toResponse(row);
    });
  }
}

function dedupe(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function toResponse(row: Tag): TagResponse {
  return { id: row.id, name: row.name };
}

function mapUniqueViolation(err: unknown, name: string): Error {
  if (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === UNIQUE_VIOLATION &&
    (err.driverError as { constraint?: string })?.constraint ===
      UNIQUE_CONSTRAINT
  ) {
    return new ConflictException(`Tag "${name}" already exists`);
  }
  return err instanceof Error ? err : new Error(String(err));
}
