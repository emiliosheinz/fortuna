import { PALETTE_KEYS } from "../tag-colors";
import { TAG_COLOR_CHECK_KEYS } from "../../database/migrations/1783266335017-AddTagColor";

describe("PALETTE_KEYS ↔ migration CHECK parity", () => {
  it("is identical: a palette change without a new migration is a rotation the DB will reject", () => {
    expect([...TAG_COLOR_CHECK_KEYS]).toEqual([...PALETTE_KEYS]);
  });
});
