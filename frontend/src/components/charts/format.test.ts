import { describe, expect, it } from "vitest";
import { formatChartValue, getNiceTicks, sanitizeValues, thinLabelIndexes } from "./format";
import { createDonutArcPath, createDonutSectorPath } from "./geometry";

describe("formatChartValue", () => {
  it("formats integer satang as baht", () => {
    expect(formatChartValue(4550, "baht")).toBe("฿45.5");
  });

  it("formats numbers and percentages with Thai locale", () => {
    expect(formatChartValue(1200, "number")).toBe("1,200");
    expect(formatChartValue(12.5, "percent")).toBe("12.5%");
  });

  it("returns a safe zero for non-finite input", () => {
    expect(formatChartValue(Number.NaN, "baht")).toBe("฿0");
    expect(formatChartValue(Number.POSITIVE_INFINITY, "number")).toBe("0");
  });
});

describe("sanitizeValues", () => {
  it("replaces invalid and negative values with zero", () => {
    expect(sanitizeValues([4, -3, Number.NaN, Number.POSITIVE_INFINITY, 2])).toEqual([4, 0, 0, 0, 2]);
  });
});

describe("getNiceTicks", () => {
  it("returns four ascending ticks that cover the largest value", () => {
    expect(getNiceTicks(73)).toEqual([0, 20, 40, 60, 80]);
  });

  it("returns stable ticks for zero and invalid maxima", () => {
    expect(getNiceTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(getNiceTicks(Number.NaN)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("thinLabelIndexes", () => {
  it("keeps every index for twelve labels or fewer", () => {
    expect(thinLabelIndexes(3)).toEqual([0, 1, 2]);
  });

  it("keeps the first and last labels while thinning long series", () => {
    expect(thinLabelIndexes(14)).toEqual([0, 2, 4, 6, 8, 10, 12, 13]);
  });
});

describe("donut path geometry", () => {
  it("builds a quarter-ring sector from outer and inner arcs", () => {
    expect(createDonutSectorPath(0, 0, 10, 5, 0, 90)).toBe("M 10 0 A 10 10 0 0 1 0 10 L 0 5 A 5 5 0 0 0 5 0 Z");
  });

  it("builds the matching centerline arc", () => {
    expect(createDonutArcPath(0, 0, 7.5, 0, 90)).toBe("M 7.5 0 A 7.5 7.5 0 0 1 0 7.5");
  });
});
