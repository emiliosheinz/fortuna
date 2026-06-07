import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_4217_RE = /^[A-Z]{3}$/;
const NUMERIC_18_2_RE = /^\d+(\.\d{1,2})?$/;
const DESCRIPTION_MAX = 500;
const TAG_NAME_MAX = 100;
const TAG_LIST_MAX = 20;

export type TransactionKind = "income" | "expense";

/**
 * Request body for `PATCH /transactions/:id`. Every field is optional;
 * absent fields are not touched. `categoryId: null` clears the link;
 * `tagNames: []` clears every tag. Passing `tagNames` reconciles the link
 * set: tags not present are detached, names not yet linked are attached
 * (creating the tag row on demand).
 */
export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE_RE, { message: "date must be YYYY-MM-DD" })
  declare date?: string;

  @IsOptional()
  @IsString()
  @Matches(NUMERIC_18_2_RE, {
    message: "amount must be a non-negative decimal with at most two places",
  })
  declare amount?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_4217_RE, {
    message: "currency must be a 3-letter ISO 4217 code",
  })
  declare currency?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DESCRIPTION_MAX)
  declare description?: string;

  @IsOptional()
  @IsIn(["income", "expense"])
  declare kind?: TransactionKind;

  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsUUID()
  declare categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_LIST_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_NAME_MAX, { each: true })
  declare tagNames?: string[];
}
