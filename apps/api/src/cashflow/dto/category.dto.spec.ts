import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CategoryDto } from "./category.dto";

async function check(input: unknown): Promise<{
  errors: string[];
  dto: CategoryDto;
}> {
  const dto = plainToInstance(CategoryDto, input);
  const errors = await validate(dto);
  return {
    errors: errors.flatMap((e) => Object.keys(e.constraints ?? {})),
    dto,
  };
}

describe("CategoryDto validation", () => {
  it("accepts a well-formed name", async () => {
    const { errors } = await check({ name: "Groceries" });
    expect(errors).toEqual([]);
  });

  it("trims surrounding whitespace before validating", async () => {
    const { errors, dto } = await check({ name: "  Groceries  " });
    expect(errors).toEqual([]);
    expect(dto.name).toBe("Groceries");
  });

  it("rejects an empty name after trimming", async () => {
    const { errors } = await check({ name: "   " });
    expect(errors).toContain("isNotEmpty");
  });

  it("rejects a missing name", async () => {
    const { errors } = await check({});
    expect(errors).toContain("isString");
  });

  it("rejects a name beyond the length cap", async () => {
    const { errors } = await check({ name: "a".repeat(101) });
    expect(errors).toContain("maxLength");
  });
});
