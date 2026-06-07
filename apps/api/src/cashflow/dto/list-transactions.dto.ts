import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Query string for `GET /transactions`. */
export class ListTransactionsDto {
  @IsOptional()
  @IsString()
  declare cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  declare limit?: number;

  resolvedLimit(): number {
    return this.limit ?? DEFAULT_LIMIT;
  }
}
