import 'server-only';
import { z } from 'zod';
import { readInternalJson, internalApiFetch } from '@/server/internal-api';
import type { components } from '@/server/api-types.generated';
import { logger } from '@/lib/logger';
import { getMemberSummary, type MemberSummary } from '@/server/loyalty';
import { pushRewardUnlocked } from '@/server/line';

export type CheckoutInput = Omit<components['schemas']['CheckoutDto'], 'staffId' | 'payment'> & {
  selfOrderId?: string;
  payment: { method: 'cash'; cashReceivedSatang: number } | { method: 'promptpay' };
};

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
  readonly code:
    | 'price_changed'
    | 'cart_limit_exceeded'
    | 'invalid_checkout'
    | 'empty_cart'
    | 'pricing'
    | 'sold_out'
    | 'member_not_found'
    | 'reward_unavailable'
    | 'reward_ineligible'
    | 'cash_insufficient'
    | 'cash_shift_required'
    | 'insufficient_recipe_stock'
    | 'promptpay_not_configured'
    | 'idempotency_key_reused'
    | 'self_order_unavailable';

  constructor(code: CheckoutError['code']) {
    super(code);
    this.code = code;
    this.name = 'CheckoutError';
  }
}

export class OrderVoidError extends Error {
  readonly code = 'reward_redemption_active';

  constructor() {
    super('reward_redemption_active');
    this.name = 'OrderVoidError';
  }
}

const dateSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const nullableDateSchema = dateSchema.nullable();

const checkoutResultSchema: z.ZodType<components['schemas']['CheckoutReceiptDto']> = z.object({
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

type OrderSummaryResponse = Omit<components['schemas']['OrderSummaryDto'], 'paidAt'> & { paidAt: Date | null };
type OrderDetailResponse = Omit<components['schemas']['OrderDetailDto'], 'paidAt' | 'voidedAt'> & {
  paidAt: Date | null;
  voidedAt: Date | null;
};

const orderSummarySchema = z.object({
  id: z.uuid(),
  dailyNo: z.number().int(),
  status: z.enum(['open', 'paid', 'void']),
  totalSatang: z.number().int(),
  paymentMethod: z.enum(['cash', 'promptpay']).nullable(),
  memberName: z.string().nullable(),
  staffName: z.string().nullable(),
  itemCount: z.number().int(),
  paidAt: nullableDateSchema,
});

const orderDetailSchema: z.ZodType<OrderDetailResponse> = orderSummarySchema.extend({
  subtotalSatang: z.number().int(),
  discountSatang: z.number().int(),
  cashReceivedSatang: z.number().int().nullable(),
  items: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      qty: z.number().int(),
      unitPriceSatang: z.number().int(),
      note: z.string().nullable(),
      modifiers: z.array(z.object({ name: z.string(), priceDeltaSatang: z.number().int() })),
    }),
  ),
  voidedAt: nullableDateSchema,
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shopName: z.string(),
  receiptFooter: z.string().nullable(),
});

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await internalApiFetch(path, init, 'API_BASE_URL is required to access orders');
  if (!response.ok) {
    let code: unknown;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'code' in body) {
        ({ code } = body);
      }
    } catch {
      // Error responses without JSON are reported using their HTTP status.
    }
    if (code === 'reward_redemption_active') {
      throw new OrderVoidError();
    }
    if (typeof code === 'string') {
      const knownCodes: CheckoutError['code'][] = [
        'price_changed', 'cart_limit_exceeded', 'invalid_checkout',
        'empty_cart',
        'pricing',
        'sold_out',
        'member_not_found',
        'reward_unavailable',
        'reward_ineligible',
        'cash_insufficient',
        'cash_shift_required',
        'insufficient_recipe_stock',
        'promptpay_not_configured',
        'idempotency_key_reused',
        'self_order_unavailable',
      ];
      if (knownCodes.includes(code as CheckoutError['code'])) {
        throw new CheckoutError(code as CheckoutError['code']);
      }
    }
    if (response.status === 400 || response.status === 422) throw new CheckoutError('invalid_checkout');
    throw new Error(`Nest orders API returned ${response.status}`);
  }
  const parsed = schema.safeParse(await readInternalJson(response));
  if (!parsed.success) {
    throw new Error('Nest orders API returned an invalid payload');
  }
  return parsed.data;
}

export async function checkout(
  session: { shopId: string; staffId: string },
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const result = await request(`/v1/shops/${encodeURIComponent(session.shopId)}/orders`, checkoutResultSchema, {
    method: 'POST',
    body: JSON.stringify({ ...input, staffId: session.staffId }),
  });
  const member = input.memberId ? await getMemberSummary(session.shopId, input.memberId) : null;
  if (!result.replayed && member && result.rewardsCreated > 0) {
    for (let i = 0; i < result.rewardsCreated; i += 1) {
      void pushRewardUnlocked(session.shopId, member.id).catch((err) =>
        logger.error({ err, shopId: session.shopId, memberId: member.id }, 'Reward notification failed'),
      );
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
    z.object({ ok: z.boolean() }) satisfies z.ZodType<components['schemas']['OrderVoidResultDto']>,
    { method: 'POST', body: JSON.stringify({ managerStaffId }) },
  );
}

const quoteSchema: z.ZodType<components['schemas']['CheckoutQuoteDto']> = z.object({
  lines: z.array(z.object({ name: z.string(), qty: z.number().int(), lineTotalSatang: z.number().int(), modifiersText: z.string() })),
  subtotalSatang: z.number().int(), discountSatang: z.number().int(), totalSatang: z.number().int(),
});
export type CheckoutQuote = z.infer<typeof quoteSchema>;
export async function quoteCheckout(session: { shopId: string; staffId: string }, input: Omit<CheckoutInput, 'payment'>): Promise<CheckoutQuote> {
  return request(`/v1/shops/${encodeURIComponent(session.shopId)}/orders/quote`, quoteSchema, {
    method: 'POST', body: JSON.stringify({ ...input, staffId: session.staffId, payment: { method: 'promptpay' } }),
  });
}
