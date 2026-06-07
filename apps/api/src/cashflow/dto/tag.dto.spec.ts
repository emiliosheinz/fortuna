import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TagDto } from "./tag.dto";

async function check(
  input: unknown,
): Promise<{ errors: string[]; dto: TagDto }> {
  const dto = plainToInstance(TagDto, input);
  const errors = await validate(dto);
  return {
    errors: errors.flatMap((e) => Object.keys(e.constraints ?? {})),
    dto,
  };
}

describe("TagDto validation", () => {
  it("accepts a well-formed name and trims surrounding whitespace", async () => {
    const { errors, dto } = await check({ name: "  travel  " });
    expect(errors).toEqual([]);
    expect(dto.name).toBe("travel");
  });

  it("rejects an empty name after trimming", async () => {
    expect((await check({ name: "   " })).errors).toContain("isNotEmpty");
  });

  it("rejects a missing name", async () => {
    expect((await check({})).errors).toContain("isString");
  });

  it("rejects a name beyond the length cap", async () => {
    expect((await check({ name: "a".repeat(101) })).errors).toContain(
      "maxLength",
    );
  });
});
