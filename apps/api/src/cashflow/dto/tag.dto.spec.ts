import { plainToInstance } from "class-transformer";
import { type ValidatorOptions, validate } from "class-validator";
import { CreateTagDto, UpdateTagDto } from "./tag.dto";

async function checkCreate(
  input: unknown,
  options: ValidatorOptions = {},
): Promise<{ errors: string[]; dto: CreateTagDto }> {
  const dto = plainToInstance(CreateTagDto, input);
  const errors = await validate(dto, options);
  return {
    errors: errors.flatMap((e) => Object.keys(e.constraints ?? {})),
    dto,
  };
}

async function checkUpdate(
  input: unknown,
): Promise<{ errors: string[]; dto: UpdateTagDto }> {
  const dto = plainToInstance(UpdateTagDto, input);
  const errors = await validate(dto);
  return {
    errors: errors.flatMap((e) => Object.keys(e.constraints ?? {})),
    dto,
  };
}

describe("CreateTagDto", () => {
  it("accepts a well-formed name and trims surrounding whitespace", async () => {
    const { errors, dto } = await checkCreate({ name: "  travel  " });
    expect(errors).toEqual([]);
    expect(dto.name).toBe("travel");
  });

  it("rejects an empty name after trimming", async () => {
    expect((await checkCreate({ name: "   " })).errors).toContain("isNotEmpty");
  });

  it("rejects a missing name", async () => {
    expect((await checkCreate({})).errors).toContain("isString");
  });

  it("rejects a name beyond the length cap", async () => {
    expect((await checkCreate({ name: "a".repeat(101) })).errors).toContain(
      "maxLength",
    );
  });

  it("rejects a body carrying a color property when whitelisting is enforced", async () => {
    const dto = plainToInstance(CreateTagDto, {
      name: "travel",
      color: "amber",
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.flatMap((e) => Object.keys(e.constraints ?? {}))).toContain(
      "whitelistValidation",
    );
  });
});

describe("UpdateTagDto", () => {
  it("accepts a name-only update", async () => {
    const { errors, dto } = await checkUpdate({ name: " travel " });
    expect(errors).toEqual([]);
    expect(dto.name).toBe("travel");
    expect(dto.color).toBeUndefined();
  });

  it("accepts a color-only update", async () => {
    const { errors, dto } = await checkUpdate({ color: "amber" });
    expect(errors).toEqual([]);
    expect(dto.color).toBe("amber");
    expect(dto.name).toBeUndefined();
  });

  it("accepts name and color together", async () => {
    const { errors } = await checkUpdate({ name: "travel", color: "sky" });
    expect(errors).toEqual([]);
  });

  it("rejects a color that is not a palette key", async () => {
    expect((await checkUpdate({ color: "bogus" })).errors).toContain("isIn");
  });

  it("rejects an empty body", async () => {
    expect((await checkUpdate({})).errors).toContain("atLeastOneOf");
  });

  it("rejects a name that trims to empty", async () => {
    expect((await checkUpdate({ name: "   " })).errors).toContain("isNotEmpty");
  });
});
