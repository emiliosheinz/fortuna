import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Request body for `POST /auth/google`.
 *
 * Validated by Nest's global `ValidationPipe`. Failures throw
 * `BadRequestException` before the handler runs — `BadRequestAuditFilter`
 * catches it on this route, records a `failure_bad_request` audit row, and
 * returns `{ correlationId }` to the client.
 */
export class GoogleSignInDto {
  /** Google ID token (JWT) obtained by apps/web during the OAuth exchange. */
  @IsString()
  @IsNotEmpty()
  declare idToken: string;

  /** Nonce that apps/web included in the OAuth `authorize` request. */
  @IsString()
  @IsNotEmpty()
  declare nonce: string;

  /**
   * Optional raw value of the long-lived `device_id` cookie, forwarded by
   * apps/web. Used to compute the per-user device fingerprint. Absence is
   * treated as a brand-new device.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  declare deviceId?: string;
}
