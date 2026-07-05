import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { SUPPORTED_CURRENCIES } from "@/fx/constants";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_18_2_RE = /^\d+(\.\d{1,2})?$/;
const DESCRIPTION_MAX = 500;
const TAG_NAME_MAX = 100;
const TAG_LIST_MAX = 20;
const INSTALLMENTS_MAX = 360;

export type TransactionKind = "income" | "expense";

export class InstallmentsHintDto {
  @IsInt()
  @Min(1)
  @Max(INSTALLMENTS_MAX)
  declare count: number;
}

/**
 * Request body for `POST /transactions`. The transaction-currency amount is
 * accepted as a string to preserve the `numeric(18, 2)` contract end-to-end —
 * a JS number can't represent `0.10` precisely.
 *
 * When `installments.count > 1` the row is split into N linked sibling rows
 * dated one calendar month apart (end-of-month clamped) sharing a generated
 * group id; `count: 1` collapses to a standalone row.
 */
export class CreateTransactionDto {
  @IsString()
  @Matches(ISO_DATE_RE, { message: "date must be YYYY-MM-DD" })
  declare date: string;

  @IsString()
  @Matches(NUMERIC_18_2_RE, {
    message: "amount must be a non-negative decimal with at most two places",
  })
  declare amount: string;

  @IsString()
  @IsIn(SUPPORTED_CURRENCIES, {
    message: `currency must be one of ${SUPPORTED_CURRENCIES.join(", ")}`,
  })
  declare currency: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(DESCRIPTION_MAX)
  declare description: string;

  @IsIn(["income", "expense"])
  declare kind: TransactionKind;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAG_LIST_MAX)
  @IsString({ each: true })
  @MaxLength(TAG_NAME_MAX, { each: true })
  declare tagNames?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => InstallmentsHintDto)
  declare installments?: InstallmentsHintDto;
}
