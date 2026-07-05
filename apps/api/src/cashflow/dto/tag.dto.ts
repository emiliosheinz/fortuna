import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  registerDecorator,
  ValidateIf,
  type ValidationOptions,
} from "class-validator";
import { PALETTE_KEYS, type PaletteKey } from "../tag-colors";

const NAME_MAX = 100;
const TRIM = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/**
 * Request body for `POST /tags`. `color` is optional: when omitted, the
 * service falls back to the deterministic `assignColor(name)` rule.
 */
export class CreateTagDto {
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  declare name: string;

  // ValidateIf(defined) — unlike @IsOptional, which silently accepts null.
  @ValidateIf((_, value) => value !== undefined)
  @IsIn([...PALETTE_KEYS])
  declare color?: PaletteKey;
}

/**
 * Request body for `PATCH /tags/:id`. Either field may be present, but at
 * least one is required. `color` must be a member of the frozen palette.
 */
export class UpdateTagDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  declare name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn([...PALETTE_KEYS])
  declare color?: PaletteKey;

  @AtLeastOneOf(["name", "color"])
  declare _atLeastOne?: never;
}

function AtLeastOneOf(fields: string[], options?: ValidationOptions) {
  return (target: object, propertyName: string): void => {
    registerDecorator({
      name: "atLeastOneOf",
      target: target.constructor,
      propertyName,
      options: {
        message: `at least one of: ${fields.join(", ")}`,
        ...options,
      },
      validator: {
        validate(_value, args) {
          const object = (args?.object ?? {}) as Record<string, unknown>;
          return fields.some(
            (field) =>
              object[field] !== undefined &&
              object[field] !== null &&
              object[field] !== "",
          );
        },
      },
    });
  };
}
