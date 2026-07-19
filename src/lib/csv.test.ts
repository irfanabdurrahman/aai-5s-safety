import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it.each(["=2+2", "+cmd", "-1+2", "@SUM(A1)", "\t=1", "\r=1"])("neutralizes spreadsheet formula input %j", (value) => expect(toCsv(["H"], [[value]])).toContain(`'${value}`));
  it("still escapes delimiters and quotes", () => expect(toCsv(["H"], [["a;b\"c"]])).toContain('"a;b""c"'));
});
