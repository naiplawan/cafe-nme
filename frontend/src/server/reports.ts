import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";

export interface SalesSummary {
  orders: number;
  voided: number;
  grossSatang: number;
  discountSatang: number;
  netSatang: number;
  cups: number;
  byMethod: { cash: number; promptpay: number };
  memberOrders: number;
  stampsIssued: number;
  rewardsRedeemed: number;
  newMembers: number;
}

const TRAILING_SLASH = /\/$/;
const shopIdSchema = z.uuid();
const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() }).refine(({ from, to }) => {
  const days = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
  return days >= 0 && days <= 365;
});
const salesSummarySchema = z.object({
  orders: z.number(),
  voided: z.number(),
  grossSatang: z.number(),
  discountSatang: z.number(),
  netSatang: z.number(),
  cups: z.number(),
  byMethod: z.object({ cash: z.number(), promptpay: z.number() }),
  memberOrders: z.number(),
  stampsIssued: z.number(),
  rewardsRedeemed: z.number(),
  newMembers: z.number(),
});
const salesByItemSchema = z.array(z.object({ name: z.string(), qty: z.number(), revenueSatang: z.number() }));
const dailySalesSchema = z.array(z.object({ date: z.iso.date(), orders: z.number(), netSatang: z.number() }));
const hourlySalesSchema = z.array(z.object({ hour: z.number().int().min(0).max(23), orders: z.number(), netSatang: z.number() }));
const categorySalesSchema = z.array(z.object({ category: z.string(), qty: z.number(), revenueSatang: z.number() }));
const memberGrowthSchema = z.array(z.object({ date: z.iso.date(), newMembers: z.number(), totalMembers: z.number() }));
const memberOverviewSchema = z.object({ total: z.number(), lineLinked: z.number(), active30d: z.number(), rewardsAvailable: z.number() });
const ordersForExportSchema = z.array(z.object({
  date: z.iso.date(),
  orderNo: z.number(),
  member: z.string(),
  paymentMethod: z.string(),
  grossSatang: z.number(),
  discountSatang: z.number(),
  netSatang: z.number(),
  cups: z.number(),
}));

interface DateRange {
  from: string;
  to: string;
}
type ReportSchema<T> = z.ZodType<T>;

function reportUrl(shopId: string, report: string, range?: DateRange) {
  const parsedShopId = shopIdSchema.safeParse(shopId);
  if (!parsedShopId.success) {
    throw new Error("A valid shop ID is required to read reports");
  }
  if (range && !rangeSchema.safeParse(range).success) {
    throw new Error("A valid report date range is required");
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required to read reports");
  }

  const url = new URL(
    `/v1/shops/${encodeURIComponent(shopId)}/reports/${report}`,
    `${apiBaseUrl.replace(TRAILING_SLASH, "")}/`,
  );
  if (range) {
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);
  }
  return url;
}

async function requestReport<T>(
  shopId: string,
  report: string,
  schema: ReportSchema<T>,
  range?: DateRange,
): Promise<T> {
  const response = await fetch(reportUrl(shopId, report, range), {
    headers: { "x-internal-api-token": createInternalApiToken() },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Nest reports API returned ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest reports API returned an invalid payload");
  }
  return parsed.data;
}

export function salesSummary(shopId: string, from: string, to: string): Promise<SalesSummary> {
  return requestReport(shopId, "sales-summary", salesSummarySchema, { from, to });
}

export function salesByItem(shopId: string, from: string, to: string): Promise<{ name: string; qty: number; revenueSatang: number }[]> {
  return requestReport(shopId, "sales-by-item", salesByItemSchema, { from, to });
}

export function dailySales(shopId: string, from: string, to: string): Promise<{ date: string; orders: number; netSatang: number }[]> {
  return requestReport(shopId, "daily-sales", dailySalesSchema, { from, to });
}

export function hourlySales(shopId: string, from: string, to: string): Promise<{ hour: number; orders: number; netSatang: number }[]> {
  return requestReport(shopId, "hourly-sales", hourlySalesSchema, { from, to });
}

export function categorySales(shopId: string, from: string, to: string): Promise<{ category: string; qty: number; revenueSatang: number }[]> {
  return requestReport(shopId, "category-sales", categorySalesSchema, { from, to });
}

export function memberGrowth(shopId: string, from: string, to: string): Promise<{ date: string; newMembers: number; totalMembers: number }[]> {
  return requestReport(shopId, "member-growth", memberGrowthSchema, { from, to });
}

export function memberOverview(shopId: string): Promise<{ total: number; lineLinked: number; active30d: number; rewardsAvailable: number }> {
  return requestReport(shopId, "member-overview", memberOverviewSchema);
}

export function ordersForExport(shopId: string, from: string, to: string): Promise<Record<string, string | number>[]> {
  return requestReport(shopId, "orders-export", ordersForExportSchema, { from, to });
}
