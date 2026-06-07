import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_4217_RE = /^[A-Z]{3}$/;
const NUMERIC_18_2_RE = /^\d+(\.\d{1,2})?$/;
const DESCRIPTION_MAX = 500;

export type TransactionKind = "income" | "expense";

/**
 * Request body for `POST /transactions`. The transaction-currency amount is
 * accepted as a string to preserve the `numeric(18, 2)` contract end-to-end —
 * a JS number can't represent `0.10` precisely.
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
  @Matches(ISO_4217_RE, {
    message: "currency must be a 3-letter ISO 4217 code",
  })
  declare currency: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(DESCRIPTION_MAX)
  declare description: string;

  @IsIn(["income", "expense"])
  declare kind: TransactionKind;
}
