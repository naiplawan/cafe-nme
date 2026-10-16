import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TransactionSql } from "postgres";
import { DatabaseService } from "./database.service.js";
import { clearExpiredSoldOut } from "./sold-out.js";

export interface CheckoutInput {
  lines: { productId: string; qty: number; modifierIds: string[]; note?: string }[];
  memberId?: string | null;
  redeemRewardId?: string | null;
  payment: { method: "cash"; cashReceivedSatang: number } | { method: "promptpay" };
}

interface PricedLine {
  productId: string;
  name: string;
  qty: number;
  note: string | null;
  earnsStamp: boolean;
  modifiers: { id: string; name: string; priceDeltaSatang: number }[];
  unitPriceSatang: number;
  lineTotalSatang: number;
}

type CheckoutFailure = "empty_cart" | "pricing" | "sold_out" | "member_not_found" | "reward_unavailable" | "cash_insufficient";

class CheckoutDomainError extends Error {
  constructor(readonly code: CheckoutFailure) { super(code); }
}

function businessDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function calculatePrice(lines: CheckoutInput["lines"], products: {
  id: string; name: string; basePriceSatang: number; earnsStamp: boolean; soldOut: boolean;
  groups: { minSelect: number; maxSelect: number; modifiers: { id: string; name: string; priceDeltaSatang: number }[] }[];
}[]): { lines: PricedLine[]; subtotalSatang: number } {
  const byId = new Map(products.map((product) => [product.id, product]));
  const priced = lines.map((line): PricedLine => {
    const product = byId.get(line.productId);
    if (!product || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99
      || new Set(line.modifierIds).size !== line.modifierIds.length) throw new CheckoutDomainError("pricing");
    if (product.soldOut) throw new CheckoutDomainError("sold_out");
    const selected = new Set(line.modifierIds);
    const modifiers = product.groups.flatMap((group) => group.modifiers).filter((modifier) => selected.has(modifier.id));
    if (modifiers.length !== line.modifierIds.length) throw new CheckoutDomainError("pricing");
    for (const group of product.groups) {
      const count = group.modifiers.filter((modifier) => selected.has(modifier.id)).length;
      if (count < group.minSelect || count > group.maxSelect) throw new CheckoutDomainError("pricing");
    }
    const note = line.note?.trim().slice(0, 120) || null;
    const unitPriceSatang = Math.max(0, product.basePriceSatang + modifiers.reduce((sum, modifier) => sum + modifier.priceDeltaSatang, 0));
    return {
      productId: product.id, name: product.name, qty: line.qty, note,
      earnsStamp: product.earnsStamp, modifiers, unitPriceSatang, lineTotalSatang: unitPriceSatang * line.qty,
    };
  });
  return { lines: priced, subtotalSatang: priced.reduce((sum, line) => sum + line.lineTotalSatang, 0) };
}

function rewardDiscount(lines: PricedLine[]): number {
  const eligible = lines.filter((line) => line.earnsStamp);
  return eligible.length === 0 ? 0 : Math.min(...eligible.map((line) => line.unitPriceSatang));
}

function stampsForLines(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + (line.earnsStamp ? line.qty : 0), 0);
}

async function checkoutMenu(tx: TransactionSql, shopId: string) {
  const rows = await tx<{
    id: string; name: string; basePriceSatang: number; earnsStamp: boolean; soldOut: boolean;
    groupId: string | null; minSelect: number | null; maxSelect: number | null;
    modifierId: string | null; modifierName: string | null; priceDeltaSatang: number | null;
  }[]>`
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
  const byProduct = new Map<string, ReturnType<typeof productsType>>();
  for (const row of rows) {
    let product = byProduct.get(row.id);
    if (!product) {
      product = { id: row.id, name: row.name, basePriceSatang: Number(row.basePriceSatang), earnsStamp: row.earnsStamp,
        soldOut: row.soldOut, groups: [] };
      byProduct.set(row.id, product);
    }
    if (row.groupId && row.minSelect !== null && row.maxSelect !== null) {
      let group = product.groups.find((entry) => entry.id === row.groupId);
      if (!group) {
        group = { id: row.groupId, minSelect: row.minSelect, maxSelect: row.maxSelect, modifiers: [] };
        product.groups.push(group);
      }
      if (row.modifierId && row.modifierName !== null && row.priceDeltaSatang !== null) {
        group.modifiers.push({ id: row.modifierId, name: row.modifierName, priceDeltaSatang: Number(row.priceDeltaSatang) });
      }
    }
  }
  return [...byProduct.values()];
}

function productsType() {
  return {
    id: "", name: "", basePriceSatang: 0, earnsStamp: false, soldOut: false,
    groups: [] as { id: string; minSelect: number; maxSelect: number; modifiers: { id: string; name: string; priceDeltaSatang: number }[] }[],
  };
}

function asNumber(value: number | string | null): number { return Number(value ?? 0); }

@Injectable()
export class OrdersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getPromptPayId(shopId: string) {
    const [shop] = await this.database.connection<{ promptpayId: string | null }[]>`
      select promptpay_id as "promptpayId" from shops where id = ${shopId}::uuid limit 1
    `;
    return shop ? { promptpayId: shop.promptpayId } : null;
  }

  async getReceiptRecipient(shopId: string, orderId: string) {
    const [recipient] = await this.database.connection<{
      dailyNo: number; hasMember: boolean; lineUserId: string | null;
    }[]>`
      select o.daily_no as "dailyNo", (o.member_id is not null) as "hasMember",
        m.line_user_id as "lineUserId"
      from orders o
      left join members m on m.id = o.member_id and m.shop_id = ${shopId}::uuid and m.deleted_at is null
      where o.id = ${orderId}::uuid and o.shop_id = ${shopId}::uuid limit 1
    `;
    return recipient ?? null;
  }

  async checkout(shopId: string, staffId: string, input: CheckoutInput) {
    if (!input.lines.length) throw new BadRequestException({ code: "empty_cart" });
    let subtotalSatang = 0;
    let stampsEarned = 0;
    let rewardsCreated = 0;
    try {
      const result = await this.database.connection.begin(async (tx) => {
        const [shop] = await tx<{ timezone: string }[]>`select timezone from shops where id = ${shopId}::uuid limit 1`;
        if (!shop) throw new NotFoundException("Shop not found");
        const day = businessDate(new Date(), shop.timezone);
        await tx`select pg_advisory_xact_lock(hashtext(${shopId + day}))`;
        await clearExpiredSoldOut(tx, shopId);
        const menu = await checkoutMenu(tx, shopId);
        const lineProductIds = new Set(input.lines.map((line) => line.productId));
        if (menu.some((product) => product.soldOut && lineProductIds.has(product.id))) {
          throw new CheckoutDomainError("sold_out");
        }
        const priced = calculatePrice(input.lines, menu);
        subtotalSatang = priced.subtotalSatang;
        stampsEarned = stampsForLines(priced.lines);

        const [actor] = await tx<{ id: string }[]>`
          select id::text as id from staff where id = ${staffId}::uuid and shop_id = ${shopId}::uuid and is_active = true limit 1
        `;
        if (!actor) throw new NotFoundException("Staff not found");
        let member: { id: string; stampGoal: number } | null = null;
        if (input.memberId) {
          const [row] = await tx<{ id: string; stampGoal: number }[]>`
            select m.id::text as id, s.stamp_goal as "stampGoal" from members m
            join shops s on s.id = m.shop_id
            where m.id = ${input.memberId}::uuid and m.shop_id = ${shopId}::uuid and m.deleted_at is null limit 1
          `;
          if (!row) throw new CheckoutDomainError("member_not_found");
          member = { id: row.id, stampGoal: Number(row.stampGoal) };
        }

        let discountSatang = 0;
        if (input.redeemRewardId) {
          if (!member) throw new CheckoutDomainError("reward_unavailable");
          const [reward] = await tx<{ id: string }[]>`
            select id::text as id from rewards where id = ${input.redeemRewardId}::uuid
              and shop_id = ${shopId}::uuid and member_id = ${member.id}::uuid and status = 'available' limit 1
          `;
          if (!reward) throw new CheckoutDomainError("reward_unavailable");
          discountSatang = Math.min(subtotalSatang, rewardDiscount(priced.lines));
        }
        const totalSatang = Math.max(0, subtotalSatang - discountSatang);
        if (input.payment.method === "cash" && input.payment.cashReceivedSatang < totalSatang) {
          throw new CheckoutDomainError("cash_insufficient");
        }
        const [numberRow] = await tx<{ max: number | string }[]>`
          select coalesce(max(daily_no), 0) as max from orders
          where shop_id = ${shopId}::uuid and business_date = ${day}
        `;
        const dailyNo = Number(numberRow?.max ?? 0) + 1;
        const [order] = await tx<{ id: string }[]>`
          insert into orders (shop_id, daily_no, business_date, status, member_id, staff_id,
            subtotal_satang, discount_satang, total_satang, paid_at)
          values (${shopId}::uuid, ${dailyNo}, ${day}, 'paid', ${member?.id ?? null}::uuid,
            ${staffId}::uuid, ${subtotalSatang}, ${discountSatang}, ${totalSatang}, now())
          returning id::text as id
        `;
        if (input.redeemRewardId && member) {
          const redeemed = await tx<{ id: string }[]>`
            update rewards set status = 'redeemed', redeemed_order_id = ${order.id}::uuid
            where id = ${input.redeemRewardId}::uuid and shop_id = ${shopId}::uuid
              and member_id = ${member.id}::uuid and status = 'available' returning id::text as id
          `;
          if (!redeemed.length) throw new CheckoutDomainError("reward_unavailable");
        }
        for (const line of priced.lines) {
          const [product] = await tx<{ id: string }[]>`
            select id::text as id from products where id = ${line.productId}::uuid and shop_id = ${shopId}::uuid limit 1
          `;
          const [item] = await tx<{ id: string }[]>`
            insert into order_items (order_id, product_id, name_snapshot, unit_price_satang, qty, note)
            values (${order.id}::uuid, ${product?.id ?? null}::uuid, ${line.name}, ${line.unitPriceSatang}, ${line.qty}, ${line.note})
            returning id::text as id
          `;
          for (const modifier of line.modifiers) {
            await tx`insert into order_item_modifiers (order_item_id, name_snapshot, price_delta_satang)
              values (${item.id}::uuid, ${modifier.name}, ${modifier.priceDeltaSatang})`;
          }
        }
        await tx`insert into payments (order_id, method, amount_satang, cash_received_satang, confirmed_by)
          values (${order.id}::uuid, ${input.payment.method}, ${totalSatang},
            ${input.payment.method === "cash" ? input.payment.cashReceivedSatang : null}, ${staffId}::uuid)`;
        if (member) {
          if (stampsEarned > 0) {
            await tx`insert into stamp_ledger (shop_id, member_id, order_id, delta, reason, staff_id)
              values (${shopId}::uuid, ${member.id}::uuid, ${order.id}::uuid, ${stampsEarned}, 'earn', ${staffId}::uuid)`;
          }
          const [balance] = await tx<{ total: number | string }[]>`
            select coalesce(sum(delta), 0) as total from stamp_ledger where shop_id = ${shopId}::uuid and member_id = ${member.id}::uuid
          `;
          let stampBalance = Number(balance?.total ?? 0);
          while (stampBalance >= member.stampGoal) {
            await tx`insert into stamp_ledger (shop_id, member_id, order_id, delta, reason, staff_id)
              values (${shopId}::uuid, ${member.id}::uuid, ${order.id}::uuid, ${-member.stampGoal}, 'redeem', ${staffId}::uuid)`;
            await tx`insert into rewards (shop_id, member_id, earned_order_id) values (${shopId}::uuid, ${member.id}::uuid, ${order.id}::uuid)`;
            stampBalance -= member.stampGoal;
            rewardsCreated++;
          }
        }
        return {
          orderId: order.id, dailyNo, subtotalSatang, discountSatang, totalSatang,
          changeSatang: input.payment.method === "cash" ? input.payment.cashReceivedSatang - totalSatang : 0,
        };
      });
      return { ...result, stampsEarned: input.memberId ? stampsEarned : 0, rewardsCreated };
    } catch (error) {
      if (error instanceof CheckoutDomainError) throw new BadRequestException({ code: error.code });
      throw error;
    }
  }

  async listOrdersForDay(shopId: string, date: string) {
    const rows = await this.database.connection<{
      id: string; dailyNo: number; status: "open" | "paid" | "void"; totalSatang: number;
      paymentMethod: "cash" | "promptpay" | null; memberName: string | null; staffName: string | null;
      itemCount: number | string; paidAt: Date | null;
    }[]>`
      select o.id::text as id, o.daily_no as "dailyNo", o.status, o.total_satang as "totalSatang",
        p.method as "paymentMethod", m.display_name as "memberName", s.name as "staffName",
        coalesce(sum(i.qty), 0) as "itemCount", o.paid_at as "paidAt"
      from orders o
      left join payments p on p.order_id = o.id
      left join members m on m.id = o.member_id and m.shop_id = ${shopId}::uuid
      left join staff s on s.id = o.staff_id and s.shop_id = ${shopId}::uuid
      left join order_items i on i.order_id = o.id
      where o.shop_id = ${shopId}::uuid and o.business_date = ${date}
      group by o.id, p.method, m.display_name, s.name
      order by o.created_at desc
    `;
    return rows.map((row) => ({ ...row, totalSatang: Number(row.totalSatang), itemCount: asNumber(row.itemCount) }));
  }

  async getOrder(shopId: string, orderId: string) {
    const [order] = await this.database.connection<{
      id: string; dailyNo: number; status: "open" | "paid" | "void"; totalSatang: number;
      subtotalSatang: number; discountSatang: number; paidAt: Date | null; voidedAt: Date | null;
      businessDate: string; shopName: string; receiptFooter: string | null; memberName: string | null;
      staffName: string | null; paymentMethod: "cash" | "promptpay" | null; cashReceivedSatang: number | null;
    }[]>`
      select o.id::text as id, o.daily_no as "dailyNo", o.status, o.total_satang as "totalSatang",
        o.subtotal_satang as "subtotalSatang", o.discount_satang as "discountSatang", o.paid_at as "paidAt",
        o.voided_at as "voidedAt", o.business_date as "businessDate", sh.name as "shopName",
        sh.receipt_footer as "receiptFooter", m.display_name as "memberName", st.name as "staffName",
        p.method as "paymentMethod", p.cash_received_satang as "cashReceivedSatang"
      from orders o join shops sh on sh.id = o.shop_id
      left join members m on m.id = o.member_id and m.shop_id = ${shopId}::uuid
      left join staff st on st.id = o.staff_id and st.shop_id = ${shopId}::uuid
      left join payments p on p.order_id = o.id
      where o.id = ${orderId}::uuid and o.shop_id = ${shopId}::uuid limit 1
    `;
    if (!order) return null;
    const itemRows = await this.database.connection<{
      id: string; name: string; qty: number; unitPriceSatang: number; note: string | null;
    }[]>`
      select id::text as id, name_snapshot as name, qty, unit_price_satang as "unitPriceSatang", note
      from order_items where order_id = ${orderId}::uuid
    `;
    const modifiers = itemRows.length ? await this.database.connection<{
      orderItemId: string; name: string; priceDeltaSatang: number;
    }[]>`
      select order_item_id::text as "orderItemId", name_snapshot as name, price_delta_satang as "priceDeltaSatang"
      from order_item_modifiers where order_item_id in ${this.database.connection(itemRows.map((item) => item.id))}
    ` : [];
    const items = itemRows.map((item) => ({
      ...item,
      modifiers: modifiers.filter((modifier) => modifier.orderItemId === item.id)
        .map(({ name, priceDeltaSatang }) => ({ name, priceDeltaSatang: Number(priceDeltaSatang) })),
    }));
    return {
      ...order,
      totalSatang: Number(order.totalSatang), subtotalSatang: Number(order.subtotalSatang),
      discountSatang: Number(order.discountSatang),
      cashReceivedSatang: order.cashReceivedSatang === null ? null : Number(order.cashReceivedSatang),
      itemCount: items.reduce((count, item) => count + Number(item.qty), 0), items,
    };
  }

  async voidOrder(shopId: string, orderId: string, managerStaffId: string): Promise<void> {
    try {
      await this.database.connection.begin(async (tx) => {
        const [order] = await tx<{ id: string; memberId: string | null }[]>`
          select id::text as id, member_id::text as "memberId" from orders
          where id = ${orderId}::uuid and shop_id = ${shopId}::uuid and status = 'paid' for update
        `;
        if (!order) throw new ConflictException("Paid order not found");
        const [manager] = await tx<{ id: string }[]>`
          select id::text as id from staff where id = ${managerStaffId}::uuid and shop_id = ${shopId}::uuid
            and role in ('owner', 'manager') and is_active = true limit 1
        `;
        if (!manager) throw new NotFoundException("Manager not found");
        let earnedRewards: { id: string; status: "available" | "redeemed" | "expired"; redeemedOrderId: string | null }[] = [];
        if (order.memberId) {
          earnedRewards = await tx<{ id: string; status: "available" | "redeemed" | "expired"; redeemedOrderId: string | null }[]>`
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
              code: "reward_redemption_active",
              message: "Void the reward redemption order first",
            });
          }
        }
        const updated = await tx<{ id: string }[]>`
          update orders set status = 'void', voided_at = now(), voided_by = ${managerStaffId}::uuid
          where id = ${orderId}::uuid and shop_id = ${shopId}::uuid and status = 'paid' returning id::text as id
        `;
        if (!updated.length) throw new ConflictException("Paid order not found");
        if (order.memberId) {
          const [stampDeltas] = await tx<{ earned: number | string; redeemed: number | string }[]>`
            select coalesce(sum(delta) filter (where reason = 'earn'), 0) as earned,
              coalesce(sum(delta) filter (where reason = 'redeem'), 0) as redeemed from stamp_ledger
            where shop_id = ${shopId}::uuid and member_id = ${order.memberId}::uuid
              and order_id = ${orderId}::uuid
          `;
          const availableRewards = earnedRewards.filter((reward) => reward.status === "available");
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
