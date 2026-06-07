import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateTransactionDto } from "./create-transaction.dto";

async function check(input: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateTransactionDto, input);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateTransactionDto validation", () => {
  const valid = {
    date: "2026-06-07",
    amount: "12.34",
    currency: "USD",
    description: "Lunch",
    kind: "expense",
  };

  it("accepts a well-formed payload", async () => {
    expect(await check(valid)).toEqual([]);
  });

  it("rejects a non-ISO-4217 currency code", async () => {
    expect(await check({ ...valid, currency: "usd" })).toContain("matches");
  });

  it("rejects more than two decimal places on amount", async () => {
    expect(await check({ ...valid, amount: "12.345" })).toContain("matches");
  });

  it("rejects a negative amount", async () => {
    expect(await check({ ...valid, amount: "-1.00" })).toContain("matches");
  });

  it("rejects a kind outside the income/expense enum", async () => {
    expect(await check({ ...valid, kind: "transfer" })).toContain("isIn");
  });

  it("rejects a non-YYYY-MM-DD date", async () => {
    expect(await check({ ...valid, date: "07/06/2026" })).toContain("matches");
  });

  it("rejects an empty description", async () => {
    expect(await check({ ...valid, description: "" })).toContain("isNotEmpty");
  });

  it("rejects a description over the length cap", async () => {
    expect(await check({ ...valid, description: "a".repeat(501) })).toContain(
      "maxLength",
    );
  });

  it("accepts an optional categoryId in UUID form", async () => {
    expect(
      await check({
        ...valid,
        categoryId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual([]);
  });

  it("rejects a non-UUID categoryId", async () => {
    expect(await check({ ...valid, categoryId: "not-a-uuid" })).toContain(
      "isUuid",
    );
  });

  it("accepts a tagNames array of strings", async () => {
    expect(await check({ ...valid, tagNames: ["travel", "lisbon"] })).toEqual(
      [],
    );
  });

  it("rejects a non-array tagNames", async () => {
    expect(await check({ ...valid, tagNames: "travel" })).toContain("isArray");
  });

  it("rejects more than the cap of tag names", async () => {
    expect(
      await check({
        ...valid,
        tagNames: Array.from({ length: 21 }, (_, i) => `t${i}`),
      }),
    ).toContain("arrayMaxSize");
  });

  it("rejects a tag name longer than the per-tag cap", async () => {
    expect(await check({ ...valid, tagNames: ["a".repeat(101)] })).toContain(
      "maxLength",
    );
  });
});
