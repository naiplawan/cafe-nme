import { describe, expect, it } from "vitest";
import { bangkokHour, dailyChartData, hourlyChartData } from "./chart-data";

describe("report chart data", () => {
  it("reads the current hour in Bangkok time", () => {
    expect(bangkokHour(new Date("2026-10-13T00:00:00.000Z"))).toBe(7);
  });

  it("fills missing days with zero sales across the selected range", () => {
    expect(dailyChartData([
      { date: "2026-10-11", netSatang: 12500 },
      { date: "2026-10-13", netSatang: 25000 },
    ], "2026-10-11", "2026-10-13")).toEqual([
      { label: "11 ต.ค.", value: 12500 },
      { label: "12 ต.ค.", value: 0 },
      { label: "13 ต.ค.", value: 25000 },
    ]);
  });

  it("highlights the current Bangkok hour when it is within today's chart range", () => {
    const result = hourlyChartData([], 13, true);
    expect(result.highlightLast).toBe(true);
    expect(result.data.map(({ label }) => label)).toEqual(["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00"]);
  });

  it("shows the full business-day range without a highlight outside today's chart hours", () => {
    const result = hourlyChartData([], 22, true);
    expect(result.highlightLast).toBe(false);
    expect(result.data).toHaveLength(16);
    expect(result.data[0].label).toBe("06:00");
    expect(result.data[15].label).toBe("21:00");
  });
});
