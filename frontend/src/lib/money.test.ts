import { describe, expect, it } from "vitest";
import { formatBaht, parseBahtToSatang, satangToInput } from "./money";

describe("parseBahtToSatang", () => {
  it.each([
    ["45", 4500],
    ["45.5", 4550],
    ["45.05", 4505],
    ["1,200.00", 120_000],
    [" 0 ", 0],
    ["-15", -1500],
    ["0.1", 10],
  ])("%s -> %d", (input, expected) => {
    expect(parseBahtToSatang(input)).toBe(expected);
  });

  it.each(["", "abc", "45.555", "4 5", "฿45", ".5"])("rejects %j", (input) => {
    expect(parseBahtToSatang(input)).toBeNull();
  });

  it("avoids float rounding errors", () => {
    expect(parseBahtToSatang("0.29")).toBe(29);
    expect(parseBahtToSatang("19.99")).toBe(1999);
  });
});

describe("formatBaht", () => {
  it("formats whole and fractional baht", () => {
    expect(formatBaht(4500)).toBe("฿45");
    expect(formatBaht(4550)).toBe("฿45.5");
    expect(formatBaht(120_000)).toBe("฿1,200");
    expect(formatBaht(-1500)).toBe("-฿15");
  });
});

describe("satangToInput", () => {
  it("round-trips through parse", () => {
    for (const s of [0, 4500, 4550, 4505, 120_000]) {
      expect(parseBahtToSatang(satangToInput(s))).toBe(s);
    }
  });
});
