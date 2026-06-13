import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const Q_MAX = 200;

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

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_RE, { message: "from must be YYYY-MM-DD" })
  declare from?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_RE, { message: "to must be YYYY-MM-DD" })
  declare to?: string;

  @IsOptional()
  @IsUUID()
  declare categoryId?: string;

  @IsOptional()
  @IsUUID()
  declare tagId?: string;

  @IsOptional()
  @IsUUID()
  declare groupId?: string;

  @IsOptional()
  @IsIn(["income", "expense"])
  declare kind?: "income" | "expense";

  @IsOptional()
  @IsString()
  @MaxLength(Q_MAX)
  declare q?: string;

  resolvedLimit(): number {
    return this.limit ?? DEFAULT_LIMIT;
  }
}
