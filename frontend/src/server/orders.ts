import "server-only";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";
import type { CartLineInput } from "@/lib/pricing";
import { logger } from "@/lib/logger";
import { getMemberSummary, type MemberSummary } from "@/server/loyalty";
import { pushRewardUnlocked } from "@/server/line";

export interface CheckoutInput {
  requestId?: string;
  lines: CartLineInput[];
  memberId?: string | null;
  redeemRewardId?: string | null;
  payment: { method: "cash"; cashReceivedSatang: number } | { method: "promptpay" };
}

export interface CheckoutResult {
  replayed?: boolean;
  orderId: string;
  dailyNo: number;
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  changeSatang: number;
  stampsEarned: number;
  rewardsCreated: number;
  member: MemberSummary | null;
}

export class CheckoutError extends Error {
  readonly code: "empty_cart" | "pricing" | "sold_out" | "member_not_found" | "reward_unavailable" | "cash_insufficient" | "promptpay_not_configured" | "idempotency_key_reused";

  constructor(code: CheckoutError["code"]) {
    super(code);
    this.code = code;
    this.name = "CheckoutError";
  }
}

export class OrderVoidError extends Error {
  readonly code = "reward_redemption_active";

  constructor() {
    super("reward_redemption_active");
    this.name = "OrderVoidError";
  }
}

const dateSchema = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const nullableDateSchema = dateSchema.nullable();

const checkoutResultSchema = z.object({
  replayed: z.boolean().optional().default(false),
  orderId: z.uuid(),
  dailyNo: z.number().int(),
  subtotalSatang: z.number().int(),
  discountSatang: z.number().int(),
  totalSatang: z.number().int(),
  changeSatang: z.number().int(),
  stampsEarned: z.number().int(),
  rewardsCreated: z.number().int(),
});

const orderSummarySchema = z.object({
  id: z.uuid(),
  dailyNo: z.number().int(),
  status: z.enum(["open", "paid", "void"]),
  totalSatang: z.number().int(),
  paymentMethod: z.enum(["cash", "promptpay"]).nullable(),
  memberName: z.string().nullable(),
  staffName: z.string().nullable(),
  itemCount: z.number().int(),
  paidAt: nullableDateSchema,
});

const orderDetailSchema = orderSummarySchema.extend({
  subtotalSatang: z.number().int(),
  discountSatang: z.number().int(),
  cashReceivedSatang: z.number().int().nullable(),
  items: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    qty: z.number().int(),
    unitPriceSatang: z.number().int(),
    note: z.string().nullable(),
    modifiers: z.array(z.object({ name: z.string(), priceDeltaSatang: z.number().int() })),
  })),
  voidedAt: nullableDateSchema,
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shopName: z.string(),
  receiptFooter: z.string().nullable(),
});

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;

const TRAILING_SLASH = /\/$/;

function apiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!baseUrl) {
    throw new Error("API_BASE_URL is required to access orders");
  }
  return baseUrl.replace(TRAILING_SLASH, "");
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    let code: unknown;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "code" in body) {
        ({ code } = body);
      }
    } catch {
      // Error responses without JSON are reported using their HTTP status.
    }
    if (code === "reward_redemption_active") {
      throw new OrderVoidError();
    }
    if (typeof code === "string") {
      const knownCodes: CheckoutError["code"][] = ["empty_cart", "pricing", "sold_out", "member_not_found", "reward_unavailable", "cash_insufficient", "promptpay_not_configured", "idempotency_key_reused"];
      if (knownCodes.includes(code as CheckoutError["code"])) {
        throw new CheckoutError(code as CheckoutError["code"]);
      }
    }
    throw new Error(`Nest orders API returned ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Nest orders API returned an invalid payload");
  }
  return parsed.data;
}

export async function checkout(
  session: { shopId: string; staffId: string },
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const result = await request(
    `/v1/shops/${encodeURIComponent(session.shopId)}/orders`,
    checkoutResultSchema,
    {
      method: "POST",
      body: JSON.stringify({ ...input, staffId: session.staffId }),
    },
  );
  const member = input.memberId ? await getMemberSummary(session.shopId, input.memberId) : null;
  if (!result.replayed && member && result.rewardsCreated > 0) {
    for (let i = 0; i < result.rewardsCreated; i += 1) {
      void pushRewardUnlocked(session.shopId, member.id).catch((err) => logger.error(
        { err, shopId: session.shopId, memberId: member.id }, "Reward notification failed",
      ));
    }
  }
  return { ...result, member };
}

export async function listOrdersForDay(shopId: string, date: string): Promise<OrderSummary[]> {
  return request(
    `/v1/shops/${encodeURIComponent(shopId)}/orders?date=${encodeURIComponent(date)}`,
    z.array(orderSummarySchema),
  );
}

export async function getOrder(shopId: string, orderId: string): Promise<OrderDetail | null> {
  return request(
    `/v1/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}`,
    orderDetailSchema.nullable(),
  );
}

export async function voidOrder(shopId: string, orderId: string, managerStaffId: string): Promise<void> {
  await request(
    `/v1/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}/void`,
    z.object({}).transform(() => undefined),
    { method: "POST", body: JSON.stringify({ managerStaffId }) },
  );
}
