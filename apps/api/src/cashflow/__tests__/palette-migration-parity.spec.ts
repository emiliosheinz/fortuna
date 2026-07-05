import { TAG_COLOR_CHECK_KEYS } from "../../database/migrations/1783266335017-AddTagColor";
import { PALETTE_KEYS } from "../tag-colors";

describe("PALETTE_KEYS ↔ migration CHECK parity", () => {
  it("is identical: a palette change without a new migration is a rotation the DB will reject", () => {
    expect([...TAG_COLOR_CHECK_KEYS]).toEqual([...PALETTE_KEYS]);
  });
});
