import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "./safe-return";

describe("safeReturnUrl", () => {
  it("accepts a normal internal path", () => expect(safeReturnUrl("/temuan/1?x=1")).toBe("/temuan/1?x=1"));
  it.each(["//evil.example", "/\\evil.example", "/%5cevil.example", "https://evil.example", "/ok\nSet-Cookie:x"])("rejects unsafe return URL %s", (value) => expect(safeReturnUrl(value)).toBe("/"));
});
