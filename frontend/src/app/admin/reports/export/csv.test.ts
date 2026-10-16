import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1)", "\t=1+1", " \r=1+1"])(
    "prefixes spreadsheet formulas with a literal marker: %j",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`);
    },
  );

  it("keeps ordinary values and CSV quote escaping", () => {
    expect(csvCell('Mali "Cafe"')).toBe('"Mali ""Cafe"""');
  });
});
