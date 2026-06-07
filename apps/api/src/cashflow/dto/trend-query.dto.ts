import { IsOptional, IsString, Matches } from "class-validator";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Query string for `GET /trend`. Both bounds optional; default is a trailing 12-month window. */
export class TrendQueryDto {
  @IsOptional()
  @IsString()
  @Matches(MONTH_RE, { message: "from must be YYYY-MM" })
  declare from?: string;

  @IsOptional()
  @IsString()
  @Matches(MONTH_RE, { message: "to must be YYYY-MM" })
  declare to?: string;
}
