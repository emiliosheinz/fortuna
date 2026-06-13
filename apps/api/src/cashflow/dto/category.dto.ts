import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

const NAME_MAX = 100;

/** Request body for `POST /categories` and `PATCH /categories/:id`. */
export class CategoryDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  declare name: string;
}
