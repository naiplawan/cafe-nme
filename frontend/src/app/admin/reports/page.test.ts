import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateRangeValid, resolveReportDateRange, shiftDate } from "./date-range";

const today = "2026-10-17";

describe("report date range", () => {
  it("shifts calendar dates across month and year boundaries", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("validates complete calendar ranges before deriving comparisons", () => {
    expect(dateRangeValid("", today)).toBe(false);
    expect(dateRangeValid("2026-02-30", today)).toBe(false);
    expect(dateRangeValid("2025-10-18", today)).toBe(true);
    expect(dateRangeValid("2025-10-17", today)).toBe(false);
  });
  it("keeps a valid range", () => {
    expect(resolveReportDateRange("2026-10-01", "2026-10-17", today)).toEqual({
      range: { from: "2026-10-01", to: "2026-10-17" },
      error: null,
    });
  });

  it("rejects malformed dates while preserving the submitted inputs", () => {
    expect(resolveReportDateRange("not-a-date", "2026-10-17", today)).toEqual({
      range: { from: "not-a-date", to: "2026-10-17" },
      error: "กรุณาเลือกวันที่ที่ถูกต้อง",
    });
  });

  it("rejects an empty date input instead of fetching with an invalid range", () => {
    expect(resolveReportDateRange("", today, today)).toEqual({
      range: { from: "", to: today },
      error: "กรุณาเลือกวันที่ที่ถูกต้อง",
    });
  });

  it("rejects a reversed range without replacing it with today", () => {
    expect(resolveReportDateRange("2026-10-18", "2026-10-17", today)).toEqual({
      range: { from: "2026-10-18", to: "2026-10-17" },
      error: "วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด",
    });
  });

  it("rejects a range longer than 365 days", () => {
    expect(resolveReportDateRange("2025-10-17", "2026-10-17", today)).toEqual({
      range: { from: "2025-10-17", to: "2026-10-17" },
      error: "เลือกช่วงเวลาไม่เกิน 365 วัน",
    });
  });

  it("accepts exactly 365 calendar dates", () => {
    expect(resolveReportDateRange("2025-10-18", "2026-10-17", today)).toEqual({
      range: { from: "2025-10-18", to: "2026-10-17" },
      error: null,
    });
  });
});

const salesSummary = vi.fn();

vi.mock("@/lib/auth", () => ({ requireStaff: vi.fn(async () => ({ shopId: "shop" })) }));
vi.mock("@/lib/business-date", () => ({ businessDate: vi.fn(() => today) }));
vi.mock("@/server/reports", () => ({
  categorySales: vi.fn(),
  dailySales: vi.fn(),
  hourlySales: vi.fn(),
  salesByItem: vi.fn(),
  salesSummary,
}));

describe("invalid report requests", () => {
  beforeEach(() => {
    salesSummary.mockReset();
  });

  it("renders the submitted range error without fetching metrics", async () => {
    const { default: ReportsPage } = await import("./page");
    const markup = renderToStaticMarkup(await ReportsPage({ searchParams: Promise.resolve({ from: "2026-10-18", to: today }) }));
    expect(markup).toContain("วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด");
    expect(markup).toContain('value="2026-10-18"');
    expect(markup).toContain(`value="${today}"`);
    expect(salesSummary).not.toHaveBeenCalled();
  });
});
