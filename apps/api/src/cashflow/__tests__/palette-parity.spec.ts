import { PALETTE_KEYS as apiKeys } from "../tag-colors";
// Direct TS import of the sibling web module. If the api jest runner ever
// stops seeing the web tree, split the invariant into a workspace package
// rather than parsing text — see AD-11.
import { PALETTE_KEYS as webKeys } from "../../../../web/src/lib/cashflow/tag-colors";

describe("PALETTE_KEYS api ↔ web parity", () => {
  it("is byte-for-byte identical in both apps", () => {
    expect([...webKeys]).toEqual([...apiKeys]);
  });
});
