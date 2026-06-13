import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { Category } from "../entities/category.entity";

export interface CategoryResponse {
  id: string;
  name: string;
}

const UNIQUE_VIOLATION = "23505";
const UNIQUE_CONSTRAINT = "categories_user_name_uq";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  async create(userId: string, name: string): Promise<CategoryResponse> {
    try {
      const saved = await this.categories.save(
        this.categories.create({ userId, name }),
      );
      return toResponse(saved);
    } catch (err) {
      throw mapUniqueViolation(err, name);
    }
  }

  async list(userId: string): Promise<CategoryResponse[]> {
    const rows = await this.categories.find({
      where: { userId },
      order: { name: "ASC" },
    });
    return rows.map(toResponse);
  }

  async rename(
    userId: string,
    id: string,
    name: string,
  ): Promise<CategoryResponse> {
    const row = await this.categories.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException("Category not found");
    }
    row.name = name;
    try {
      const saved = await this.categories.save(row);
      return toResponse(saved);
    } catch (err) {
      throw mapUniqueViolation(err, name);
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.categories.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException("Category not found");
    }
  }
}

function toResponse(row: Category): CategoryResponse {
  return { id: row.id, name: row.name };
}

function mapUniqueViolation(err: unknown, name: string): Error {
  if (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === UNIQUE_VIOLATION &&
    (err.driverError as { constraint?: string })?.constraint ===
      UNIQUE_CONSTRAINT
  ) {
    return new ConflictException(`Category "${name}" already exists`);
  }
  return err instanceof Error ? err : new Error(String(err));
}
