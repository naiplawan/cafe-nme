import { describe, expect, it } from "vitest";
import { businessDate, businessDayRange } from "./business-date";

describe("businessDate", () => {
  it("uses the local calendar day in the requested timezone", () => {
    expect(businessDate(new Date("2026-01-01T17:30:00Z"))).toBe("2026-01-02");
    expect(businessDate(new Date("2026-01-01T17:30:00Z"), "UTC")).toBe("2026-01-01");
  });
});

describe("businessDayRange", () => {
  it("returns consecutive local midnights as UTC instants", () => {
    expect(businessDayRange("2026-01-02")).toEqual({
      start: new Date("2026-01-01T17:00:00.000Z"),
      end: new Date("2026-01-02T17:00:00.000Z"),
    });
  });

  it("rejects malformed dates", () => {
    expect(() => businessDayRange("2026-1-02")).toThrow();
  });
});
