import { IsIn, IsString } from "class-validator";
import { SUPPORTED_CURRENCIES } from "@/fx/constants";

/**
 * Request body for `PUT /users/me/base-currency`.
 *
 * Validated by Nest's global `ValidationPipe`. The base currency is restricted
 * to the product-supported set (matches the read-time conversion coverage).
 */
export class SetBaseCurrencyDto {
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES, {
    message: `baseCurrency must be one of ${SUPPORTED_CURRENCIES.join(", ")}`,
  })
  declare baseCurrency: string;
}
