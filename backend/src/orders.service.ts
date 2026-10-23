import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TransactionSql } from 'postgres';
import {
  businessDate,
  calculatePrice,
  CheckoutDomainError,
  MAX_CHECKOUT_UNITS,
  rewardDiscount,
  stampsForLines,
  type CheckoutCartLine,
  type CheckoutProduct,
} from './checkout-domain.js';
import { DatabaseService } from './database.service.js';
import { clearExpiredSoldOut } from './sold-out.js';

export interface CheckoutInput {
  requestId?: string;
  expectedTotalSatang?: number;
  lines: CheckoutCartLine[];
  memberId?: string | null;
  redeemRewardId?: string | null;
  payment: { method: 'cash'; cashReceivedSatang: number } | { method: 'promptpay' };
}

export interface CheckoutReceipt {
  orderId: string;
  dailyNo: number;
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  changeSatang: number;
  stampsEarned: number;
  rewardsCreated: number;
  replayed: boolean;
}

async function checkoutMenu(tx: TransactionSql, shopId: string) {
  const rows = await tx<
    {
      id: string;
      name: string;
      basePriceSatang: number;
      earnsStamp: boolean;
      soldOut: boolean;
      groupId: string | null;
      minSelect: number | null;
      maxSelect: number | null;
      modifierId: string | null;
      modifierName: string | null;
      priceDeltaSatang: number | null;
    }[]
  >`
    select p.id::text as id, p.name, p.base_price_satang as "basePriceSatang",
      p.earns_stamp as "earnsStamp", p.sold_out as "soldOut",
      mg.id::text as "groupId", mg.min_select as "minSelect", mg.max_select as "maxSelect",
      m.id::text as "modifierId", m.name as "modifierName", m.price_delta_satang as "priceDeltaSatang"
    from products p
    left join product_modifier_groups pmg on pmg.product_id = p.id
    left join modifier_groups mg on mg.id = pmg.group_id and mg.shop_id = ${shopId}::uuid
    left join modifiers m on m.group_id = mg.id
    where p.shop_id = ${shopId}::uuid and p.is_active = true
    order by p.sort, pmg.sort, mg.sort, m.sort
  `;
  const byProduct = new Map<string, CheckoutProduct>();
  for (const row of rows) {
    let product = byProduct.get(row.id);
    if (!product) {
      product = {
        id: row.id,
        name: row.name,
        basePriceSatang: Number(row.basePriceSatang),
        earnsStamp: row.earnsStamp,
        soldOut: row.soldOut,
        groups: [],
      };
      byProduct.set(row.id, product);
    }
    if (row.groupId && row.minSelect !== null && row.maxSelect !== null) {
      let group = product.groups.find((entry) => entry.id === row.groupId);
      if (!group) {
        group = { id: row.groupId, minSelect: row.minSelect, maxSelect: row.maxSelect, modifiers: [] };
        product.groups.push(group);
      }
      if (row.modifierId && row.modifierName !== null && row.priceDeltaSatang !== null) {
        group.modifiers.push({
          id: row.modifierId,
          name: row.modifierName,
          priceDeltaSatang: Number(row.priceDeltaSatang),
        });
      }
    }
  }
  return [...byProduct.values()];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestIdForCheckout(input: CheckoutInput): string {
  if (input.requestId === undefined) {
    return randomUUID();
  }
  if (!UUID_PATTERN.test(input.requestId)) {
    throw new BadRequestException('requestId must be a valid UUID');
  }
  return input.requestId.toLowerCase();
}

function checkoutFingerprint(staffId: string, input: CheckoutInput): string {
  const canonical = {
    staffId: staffId.toLowerCase(),
    lines: input.lines.map((line) => ({
      productId: line.productId.toLowerCase(),
      qty: line.qty,
      modifierIds: line.modifierIds.map((modifierId) => modifierId.toLowerCase()).sort(),
      note: line.note?.trim().slice(0, 120) || null,
    })),
    memberId: input.memberId?.toLowerCase() ?? null,
    redeemRewardId: input.redeemRewardId?.toLowerCase() ?? null,
    ...(input.expectedTotalSatang === undefined ? {} : { expectedTotalSatang: input.expectedTotalSatang }),
    payment:
      input.payment.method === 'cash'
        ? { method: 'cash', cashReceivedSatang: input.payment.cashReceivedSatang }
        : { method: 'promptpay' },
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function parseCheckoutResult(value: unknown): CheckoutReceipt | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' ? (value as CheckoutReceipt) : null;
}

async function checkoutPrice(tx: TransactionSql, shopId: string, input: Pick<CheckoutInput, 'lines' | 'memberId' | 'redeemRewardId'>) {
  await clearExpiredSoldOut(tx, shopId);
  const menu = await checkoutMenu(tx, shopId);
  const lineProductIds = new Set(input.lines.map((line) => line.productId));
  if (menu.some((product) => product.soldOut && lineProductIds.has(product.id))) {
    throw new CheckoutDomainError('sold_out');
  }
  const priced = calculatePrice(input.lines, menu);
  const { subtotalSatang } = priced;
  let member: { id: string; stampGoal: number } | null = null;
  if (input.memberId) {
    const [row] = await tx<{ id: string; stampGoal: number }[]>`
      select m.id::text as id, s.stamp_goal as "stampGoal" from members m
      join shops s on s.id = m.shop_id
      where m.id = ${input.memberId}::uuid and m.shop_id = ${shopId}::uuid and m.deleted_at is null limit 1
    `;
    if (!row) throw new CheckoutDomainError('member_not_found');
    member = { id: row.id, stampGoal: Number(row.stampGoal) };
  }

  let discountSatang = 0;
  if (input.redeemRewardId) {
    if (!member) throw new CheckoutDomainError('reward_unavailable');
    const [reward] = await tx<{ id: string }[]>`
      select id::text as id from rewards where id = ${input.redeemRewardId}::uuid
        and shop_id = ${shopId}::uuid and member_id = ${member.id}::uuid and status = 'available' limit 1
    `;
    if (!reward) throw new CheckoutDomainError('reward_unavailable');
    discountSatang = Math.min(subtotalSatang, rewardDiscount(priced.lines));
    if (discountSatang === 0) { throw new CheckoutDomainError('reward_ineligible'); }
  }
  const totalSatang = Math.max(0, subtotalSatang - discountSatang);
  return { ...priced, discountSatang, totalSatang, member };
}

@Injectable()
export class OrdersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async quote(shopId: string, staffId: string, input: CheckoutInput) {
    if (!input.lines.length) throw new BadRequestException({ code: 'empty_cart' });
    try {
      return await this.database.connection.begin(async (tx) => {
        const [actor] = await tx`select id from staff where id = ${staffId}::uuid and shop_id = ${shopId}::uuid and is_active = true`;
        if (!actor) throw new NotFoundException('Staff not found');
        const { lines, subtotalSatang, discountSatang, totalSatang } = await checkoutPrice(tx, shopId, input);
        return {
          lines: lines.map(({ name, qty, lineTotalSatang, modifiers }) => ({
            name, qty, lineTotalSatang,
            modifiersText: modifiers.map((modifier) => modifier.name).join(', '),
          })),
          subtotalSatang, discountSatang, totalSatang,
        };
      });
    } catch (error) {
      if (error instanceof CheckoutDomainError) throw new BadRequestException({ code: error.code });
      throw error;
    }
  }

  async checkout(shopId: string, staffId: string, input: CheckoutInput): Promise<CheckoutReceipt> {
    if (input.lines.length === 0) throw new BadRequestException({ code: 'empty_cart' });
    if (input.lines.length > 100 || input.lines.reduce((total, line) => total + line.qty, 0) > MAX_CHECKOUT_UNITS) {
      throw new BadRequestException({ code: 'cart_limit_exceeded' });
    }
    const requestId = requestIdForCheckout(input);
    const fingerprint = checkoutFingerprint(staffId, input);
    const lockShopId = shopId.toLowerCase();
    try {
      return await this.database.connection.begin(async (tx): Promise<CheckoutReceipt> => {
        // Checkout and PromptPay settings updates use the shop row in this order:
        // checkout takes FOR SHARE first, while an owner update takes the UPDATE lock.
        const [shop] = await tx<{ timezone: string; promptpayId: string | null }[]>`
          select timezone, promptpay_id as "promptpayId"
          from shops where id = ${shopId}::uuid limit 1 for share
        `;
        if (!shop) throw new NotFoundException('Shop not found');

        const [actor] = await tx<{ id: string }[]>`
          select id::text as id from staff where id = ${staffId}::uuid and shop_id = ${shopId}::uuid and is_active = true limit 1
        `;
        if (!actor) throw new NotFoundException('Staff not found');

        const day = businessDate(new Date(), shop.timezone);
        await tx`select pg_advisory_xact_lock(hashtextextended(${`${lockShopId}:${requestId}`}, 0))`;
        const [existing] = await tx<
          {
            checkoutFingerprint: string | null;
            checkoutResult: unknown;
          }[]
        >`
          select checkout_fingerprint as "checkoutFingerprint", checkout_result as "checkoutResult"
          from orders where shop_id = ${shopId}::uuid and checkout_key = ${requestId}::uuid limit 1
        `;
        if (existing) {
          const stored = parseCheckoutResult(existing.checkoutResult);
          if (existing.checkoutFingerprint !== fingerprint || !stored) {
            throw new ConflictException({ code: 'idempotency_key_reused' });
          }
          return { ...stored, replayed: true };
        }

        await tx`select pg_advisory_xact_lock(hashtext(${lockShopId + day}))`;
        const priced = await checkoutPrice(tx, shopId, input);
        const { subtotalSatang, discountSatang, totalSatang, member } = priced;
        const stampsEarned = stampsForLines(priced.lines);
        let rewardsCreated = 0;
        if (input.expectedTotalSatang !== undefined && input.expectedTotalSatang !== totalSatang) {
          throw new CheckoutDomainError('price_changed');
        }
        if (input.payment.method === 'cash' && input.payment.cashReceivedSatang < totalSatang) {
          throw new CheckoutDomainError('cash_insufficient');
        }
        if (input.payment.method === 'promptpay' && !shop.promptpayId) {
          throw new CheckoutDomainError('promptpay_not_configured');
        }
        const [numberRow] = await tx<{ max: number | string }[]>`
          select coalesce(max(daily_no), 0) as max from orders
          where shop_id = ${shopId}::uuid and business_date = ${day}
        `;
        const dailyNo = Number(numberRow?.max ?? 0) + 1;
        const [order] = await tx<{ id: string }[]>`
          insert into orders (shop_id, daily_no, business_date, status, member_id, staff_id,
            subtotal_satang, discount_satang, total_satang, paid_at, checkout_key, checkout_fingerprint)
          values (${shopId}::uuid, ${dailyNo}, ${day}, 'paid', ${member?.id ?? null}::uuid,
            ${staffId}::uuid, ${subtotalSatang}, ${discountSatang}, ${totalSatang}, now(),
            ${requestId}::uuid, ${fingerprint})
          returning id::text as id
        `;
        if (input.redeemRewardId && member) {
          const redeemed = await tx<{ id: string }[]>`
            update rewards set status = 'redeemed', redeemed_order_id = ${order.id}::uuid
            where id = ${input.redeemRewardId}::uuid and shop_id = ${shopId}::uuid
              and member_id = ${member.id}::uuid and status = 'available' returning id::text as id
          `;
          if (redeemed.length === 0) throw new CheckoutDomainError('reward_unavailable');
        }
        const itemIds = priced.lines.map(() => randomUUID());
        await tx`
          insert into order_items (id, order_id, product_id, name_snapshot, unit_price_satang, qty, note, line_no)
          select input.id, ${order.id}::uuid, product.id, input.name, input.price, input.qty, input.note, input.line_no
          from unnest(
            ${itemIds}::uuid[],
            ${priced.lines.map((line) => line.productId)}::uuid[],
            ${priced.lines.map((line) => line.name)}::text[],
            ${priced.lines.map((line) => line.unitPriceSatang)}::integer[],
            ${priced.lines.map((line) => line.qty)}::integer[],
            ${priced.lines.map((line) => line.note)}::text[]
          ) with ordinality as input(id, product_id, name, price, qty, note, line_no)
          left join products product on product.id = input.product_id and product.shop_id = ${shopId}::uuid
          order by input.line_no
        `;
        const modifierRows = priced.lines.flatMap((line, index) =>
          line.modifiers.map((modifier) => ({
            itemId: itemIds[index],
            name: modifier.name,
            price: modifier.priceDeltaSatang,
          })),
        );
        if (modifierRows.length) {
          await tx`insert into order_item_modifiers (order_item_id, name_snapshot, price_delta_satang)
            select input.item_id, input.name, input.price from unnest(
              ${modifierRows.map((modifier) => modifier.itemId)}::uuid[],
              ${modifierRows.map((modifier) => modifier.name)}::text[],
              ${modifierRows.map((modifier) => modifier.price)}::integer[]
            ) as input(item_id, name, price)`;
        }
        await tx`insert into payments (order_id, method, amount_satang, cash_received_satang, confirmed_by)
          values (${order.id}::uuid, ${input.payment.method}, ${totalSatang},
            ${input.payment.method === 'cash' ? input.payment.cashReceivedSatang : null}, ${staffId}::uuid)`;
        if (member) {
          if (stampsEarned > 0) {
            await tx`insert into stamp_ledger (shop_id, member_id, order_id, delta, reason, staff_id)
              values (${shopId}::uuid, ${member.id}::uuid, ${order.id}::uuid, ${stampsEarned}, 'earn', ${staffId}::uuid)`;
          }
          const [balance] = await tx<{ total: number | string }[]>`
            select coalesce(sum(delta), 0) as total from stamp_ledger where shop_id = ${shopId}::uuid and member_id = ${member.id}::uuid
          `;
          const stampBalance = Number(balance?.total ?? 0);
          rewardsCreated = Math.floor(stampBalance / member.stampGoal);
          if (rewardsCreated > 0) {
            await tx`insert into stamp_ledger (shop_id, member_id, order_id, delta, reason, staff_id)
              select ${shopId}::uuid, ${member.id}::uuid, ${order.id}::uuid, ${-member.stampGoal}, 'redeem', ${staffId}::uuid
              from generate_series(1, ${rewardsCreated})`;
            await tx`insert into rewards (shop_id, member_id, earned_order_id)
              select ${shopId}::uuid, ${member.id}::uuid, ${order.id}::uuid from generate_series(1, ${rewardsCreated})`;
          }
        }
        const receipt: CheckoutReceipt = {
          orderId: order.id,
          dailyNo,
          subtotalSatang,
          discountSatang,
          totalSatang,
          changeSatang: input.payment.method === 'cash' ? input.payment.cashReceivedSatang - totalSatang : 0,
          stampsEarned: member ? stampsEarned : 0,
          rewardsCreated,
          replayed: false,
        };
        await tx`update orders set checkout_result = ${JSON.stringify(receipt)}::jsonb where id = ${order.id}::uuid`;
        return receipt;
      });
    } catch (error) {
      if (error instanceof CheckoutDomainError) throw new BadRequestException({ code: error.code });
      throw error;
    }
  }

  async voidOrder(shopId: string, orderId: string, managerStaffId: string): Promise<void> {
    try {
      await this.database.connection.begin(async (tx) => {
        const [order] = await tx<{ id: string; memberId: string | null }[]>`
          select id::text as id, member_id::text as "memberId" from orders
          where id = ${orderId}::uuid and shop_id = ${shopId}::uuid and status = 'paid' for update
        `;
        if (!order) throw new ConflictException('Paid order not found');
        const [manager] = await tx<{ id: string }[]>`
          select id::text as id from staff where id = ${managerStaffId}::uuid and shop_id = ${shopId}::uuid
            and role in ('owner', 'manager') and is_active = true limit 1
        `;
        if (!manager) throw new NotFoundException('Manager not found');
        let earnedRewards: {
          id: string;
          status: 'available' | 'redeemed' | 'expired';
          redeemedOrderId: string | null;
        }[] = [];
        if (order.memberId) {
          earnedRewards = await tx<
            { id: string; status: 'available' | 'redeemed' | 'expired'; redeemedOrderId: string | null }[]
          >`
            select id::text as id, status, redeemed_order_id::text as "redeemedOrderId"
            from rewards where shop_id = ${shopId}::uuid and member_id = ${order.memberId}::uuid
              and earned_order_id = ${orderId}::uuid order by id for update
          `;
          const [activeRedemption] = await tx<{ id: string }[]>`
            select redemption.id::text as id from rewards reward
            join orders redemption on redemption.id = reward.redeemed_order_id
              and redemption.shop_id = reward.shop_id and redemption.status = 'paid'
            where reward.shop_id = ${shopId}::uuid and reward.member_id = ${order.memberId}::uuid
              and reward.earned_order_id = ${orderId}::uuid and reward.status = 'redeemed'
            limit 1
          `;
          if (activeRedemption) {
            throw new ConflictException({
              code: 'reward_redemption_active',
              message: 'Void the reward redemption order first',
            });
          }
        }
        const updated = await tx<{ id: string }[]>`
          update orders set status = 'void', voided_at = now(), voided_by = ${managerStaffId}::uuid
          where id = ${orderId}::uuid and shop_id = ${shopId}::uuid and status = 'paid' returning id::text as id
        `;
        if (!updated.length) throw new ConflictException('Paid order not found');
        if (order.memberId) {
          const [stampDeltas] = await tx<{ earned: number | string; redeemed: number | string }[]>`
            select coalesce(sum(delta) filter (where reason = 'earn'), 0) as earned,
              coalesce(sum(delta) filter (where reason = 'redeem'), 0) as redeemed from stamp_ledger
            where shop_id = ${shopId}::uuid and member_id = ${order.memberId}::uuid
              and order_id = ${orderId}::uuid
          `;
          const availableRewards = earnedRewards.filter((reward) => reward.status === 'available');
          const compensation = -Number(stampDeltas?.earned ?? 0) - Number(stampDeltas?.redeemed ?? 0);
          await tx`insert into stamp_ledger (shop_id, member_id, order_id, delta, reason, staff_id)
            values (${shopId}::uuid, ${order.memberId}::uuid, ${orderId}::uuid, ${compensation}, 'adjust', ${managerStaffId}::uuid)`;
          if (availableRewards.length) {
            await tx`update rewards set status = 'expired' where shop_id = ${shopId}::uuid and member_id = ${order.memberId}::uuid
              and earned_order_id = ${orderId}::uuid and status = 'available'`;
          }
          await tx`update rewards set status = 'available', redeemed_order_id = null
            where shop_id = ${shopId}::uuid and redeemed_order_id = ${orderId}::uuid and status = 'redeemed'`;
        }
        await tx`insert into audit_log (shop_id, actor, action, payload)
          values (${shopId}::uuid, ${managerStaffId}, 'orders.void', ${tx.json({ orderId })})`;
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      throw error;
    }
  }
}
