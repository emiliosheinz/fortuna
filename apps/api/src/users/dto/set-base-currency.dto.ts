import { IsString, Matches } from "class-validator";

/**
 * Request body for `PUT /users/me/base-currency`.
 *
 * Validated by Nest's global `ValidationPipe`. Anything other than three
 * uppercase letters is rejected before the handler runs; deeper coverage
 * checks against the FX provider live in Phase 3.
 */
export class SetBaseCurrencyDto {
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: "baseCurrency must be a 3-letter ISO 4217 code",
  })
  declare baseCurrency: string;
}
