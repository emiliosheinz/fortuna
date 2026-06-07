import { decodeCursor, encodeCursor } from "./cursor";

describe("cursor encoding", () => {
  it("round-trips through base64url", () => {
    const original = {
      date: "2026-06-07",
      id: "11111111-2222-3333-4444-555555555555",
    };

    const cursor = encodeCursor(original);
    const decoded = decodeCursor(cursor);

    expect(decoded).toEqual(original);
  });

  it("rejects a cursor whose date is not YYYY-MM-DD", () => {
    const cursor = Buffer.from(
      "not-a-date|11111111-2222-3333-4444-555555555555",
    ).toString("base64url");

    expect(() => decodeCursor(cursor)).toThrow();
  });

  it("rejects a cursor whose id is not a uuid", () => {
    const cursor = Buffer.from("2026-06-07|not-a-uuid").toString("base64url");

    expect(() => decodeCursor(cursor)).toThrow();
  });

  it("rejects a cursor that is not base64-decodable to two pipe-separated fields", () => {
    expect(() => decodeCursor("???")).toThrow();
  });
});
