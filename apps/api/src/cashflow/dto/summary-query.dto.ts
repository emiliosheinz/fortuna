import { IsString, Matches } from "class-validator";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Query string for `GET /summary`. `month` is the ISO YYYY-MM bucket. */
export class SummaryQueryDto {
  @IsString()
  @Matches(MONTH_RE, { message: "month must be YYYY-MM" })
  declare month: string;
}
