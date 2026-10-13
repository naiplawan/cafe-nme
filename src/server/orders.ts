import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, categories, members, modifierGroups, modifiers, orderItemModifiers, orderItems,
  orders, payments, productModifierGroups, products, rewards, shops, staff, stampLedger } from "@/db/schema";
import { businessDate } from "@/lib/business-date";
import { hasSoldOutLine, priceCart, PricingError, rewardDiscount, stampsForLines, type CartLineInput, type PosMenu } from "@/lib/pricing";
import { logger } from "@/lib/logger";
import { getMemberSummary, type MemberSummary } from "@/server/loyalty";
import { pushRewardUnlocked } from "@/server/line";
type CheckoutTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CheckoutInput = { lines: CartLineInput[]; memberId?: string | null; redeemRewardId?: string | null;
  payment: { method: "cash"; cashReceivedSatang: number } | { method: "promptpay" } };
export type CheckoutResult = { orderId: string; dailyNo: number; subtotalSatang: number; discountSatang: number; totalSatang: number;
  changeSatang: number; stampsEarned: number; rewardsCreated: number; member: MemberSummary | null };
export class CheckoutError extends Error {
  constructor(public code: "empty_cart" | "pricing" | "sold_out" | "member_not_found" | "reward_unavailable" | "cash_insufficient") {
    super(code);
    this.name = "CheckoutError";
  }
}

async function getMenuForCheckout(tx: CheckoutTx, shopId: string): Promise<PosMenu> {
  const categoryRows = await tx.select({ id: categories.id, name: categories.name }).from(categories)
    .where(eq(categories.shopId, shopId)).orderBy(asc(categories.sort));
  const productRows = await tx.select({ id: products.id, name: products.name, categoryId: products.categoryId,
    basePriceSatang: products.basePriceSatang, imageUrl: products.imageUrl, earnsStamp: products.earnsStamp,
    soldOut: products.soldOut })
    .from(products).where(and(eq(products.shopId, shopId), eq(products.isActive, true)));
  if (!productRows.length) return { categories: categoryRows, products: [] };
  const groupRows = await tx.select({ productId: productModifierGroups.productId,
    groupId: modifierGroups.id, groupName: modifierGroups.name, minSelect: modifierGroups.minSelect,
    maxSelect: modifierGroups.maxSelect, modifierId: modifiers.id, modifierName: modifiers.name,
    priceDeltaSatang: modifiers.priceDeltaSatang, groupSort: productModifierGroups.sort,
    modifierSort: modifiers.sort })
    .from(productModifierGroups).innerJoin(modifierGroups,
      and(eq(productModifierGroups.groupId, modifierGroups.id), eq(modifierGroups.shopId, shopId)))
    .leftJoin(modifiers, eq(modifiers.groupId, modifierGroups.id))
    .where(inArray(productModifierGroups.productId, productRows.map(({ id }) => id)))
    .orderBy(asc(productModifierGroups.sort), asc(modifierGroups.sort), asc(modifiers.sort));
  const groupsByProduct = new Map<string, Map<string, { id: string; name: string; minSelect: number; maxSelect: number;
    modifiers: { id: string; name: string; priceDeltaSatang: number }[] }>>();
  for (const row of groupRows) {
    const groups = groupsByProduct.get(row.productId) ?? new Map();
    const group = groups.get(row.groupId) ?? { id: row.groupId, name: row.groupName,
      minSelect: row.minSelect, maxSelect: row.maxSelect, modifiers: [] };
    if (row.modifierId && row.modifierName !== null && row.priceDeltaSatang !== null) {
      group.modifiers.push({ id: row.modifierId, name: row.modifierName, priceDeltaSatang: row.priceDeltaSatang });
    }
    groups.set(row.groupId, group);
    groupsByProduct.set(row.productId, groups);
  }
  return { categories: categoryRows, products: productRows.map((product) => ({ ...product,
    groups: [...(groupsByProduct.get(product.id)?.values() ?? [])] })) };
}

export async function checkout(session: { shopId: string; staffId: string }, input: CheckoutInput): Promise<CheckoutResult> {
  if (input.lines.length === 0) throw new CheckoutError("empty_cart");
  let subtotalSatang = 0;
  let stampsEarned = 0;
  let rewardsCreated = 0;
  const result = await db.transaction(async (tx) => {
    const [shop] = await tx.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, session.shopId)).limit(1);
    if (!shop) throw new Error("Shop not found");
    const businessDay = businessDate(new Date(), shop.timezone);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.shopId + businessDay}))`);
    let priced: ReturnType<typeof priceCart>;
    try {
      const menu = await getMenuForCheckout(tx, session.shopId);
      if (hasSoldOutLine(input.lines, menu)) {
        throw new CheckoutError("sold_out");
      }
      priced = priceCart(input.lines, menu);
    } catch (error) {
      if (error instanceof PricingError) throw new CheckoutError("pricing");
      throw error;
    }
    subtotalSatang = priced.subtotalSatang;
    stampsEarned = stampsForLines(priced.lines);
    const [actor] = await tx.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, session.staffId), eq(staff.shopId, session.shopId), eq(staff.isActive, true))).limit(1);
    if (!actor) throw new Error("Staff not found");
    let member: { id: string; stampGoal: number } | null = null;
    if (input.memberId) {
      const [memberRow] = await tx.select({ id: members.id, stampGoal: shops.stampGoal }).from(members)
        .innerJoin(shops, eq(shops.id, members.shopId))
        .where(and(eq(members.id, input.memberId), eq(members.shopId, session.shopId), isNull(members.deletedAt))).limit(1);
      if (!memberRow) throw new CheckoutError("member_not_found");
      member = memberRow;
    }

    let discountSatang = 0;
    if (input.redeemRewardId) {
      if (!member) throw new CheckoutError("reward_unavailable");
      const [reward] = await tx.select({ id: rewards.id }).from(rewards).where(and(
        eq(rewards.id, input.redeemRewardId), eq(rewards.shopId, session.shopId), eq(rewards.memberId, member.id),
        eq(rewards.status, "available"),
      )).limit(1);
      if (!reward) throw new CheckoutError("reward_unavailable");
      discountSatang = Math.min(subtotalSatang, rewardDiscount(priced.lines));
    }
    const totalSatang = Math.max(0, subtotalSatang - discountSatang);
    if (input.payment.method === "cash" && input.payment.cashReceivedSatang < totalSatang) {
      throw new CheckoutError("cash_insufficient");
    }
    const [numberRow] = await tx.select({ max: sql<number>`coalesce(max(${orders.dailyNo}), 0)` }).from(orders)
      .where(and(eq(orders.shopId, session.shopId), eq(orders.businessDate, businessDay)));
    const dailyNo = Number(numberRow?.max ?? 0) + 1;
    const now = new Date();
    const [order] = await tx.insert(orders).values({ shopId: session.shopId, dailyNo, businessDate: businessDay,
      status: "paid", memberId: member?.id ?? null, staffId: session.staffId, subtotalSatang,
      discountSatang, totalSatang, paidAt: now }).returning({ id: orders.id });
    if (input.redeemRewardId) {
      const redeemed = await tx.update(rewards).set({ status: "redeemed", redeemedOrderId: order.id })
        .where(and(eq(rewards.id, input.redeemRewardId), eq(rewards.shopId, session.shopId),
          eq(rewards.memberId, member!.id), eq(rewards.status, "available"))).returning({ id: rewards.id });
      if (redeemed.length === 0) throw new CheckoutError("reward_unavailable");
    }

    for (const line of priced.lines) {
      const product = await tx.select({ id: products.id }).from(products)
        .where(and(eq(products.id, line.productId), eq(products.shopId, session.shopId))).limit(1);
      const [item] = await tx.insert(orderItems).values({ orderId: order.id, productId: product[0]?.id ?? null,
        nameSnapshot: line.name, unitPriceSatang: line.unitPriceSatang, qty: line.qty, note: line.note })
        .returning({ id: orderItems.id });
      if (line.modifiers.length) await tx.insert(orderItemModifiers).values(line.modifiers.map((modifier) => ({
        orderItemId: item.id, nameSnapshot: modifier.name, priceDeltaSatang: modifier.priceDeltaSatang,
      })));
    }
    await tx.insert(payments).values({ orderId: order.id, method: input.payment.method, amountSatang: totalSatang,
      cashReceivedSatang: input.payment.method === "cash" ? input.payment.cashReceivedSatang : null,
      confirmedBy: session.staffId });

    if (member) {
      if (stampsEarned > 0) await tx.insert(stampLedger).values({ shopId: session.shopId, memberId: member.id,
        orderId: order.id, delta: stampsEarned, reason: "earn", staffId: session.staffId });
      const [balance] = await tx.select({ total: sql<number>`coalesce(sum(${stampLedger.delta}), 0)` })
        .from(stampLedger).where(and(eq(stampLedger.shopId, session.shopId), eq(stampLedger.memberId, member.id)));
      let stampBalance = Number(balance?.total ?? 0);
      while (stampBalance >= member.stampGoal) {
        await tx.insert(stampLedger).values({ shopId: session.shopId, memberId: member.id,
          orderId: order.id, delta: -member.stampGoal, reason: "redeem", staffId: session.staffId });
        await tx.insert(rewards).values({ shopId: session.shopId, memberId: member.id, earnedOrderId: order.id });
        stampBalance -= member.stampGoal;
        rewardsCreated++;
      }
    }
    return { orderId: order.id, dailyNo, discountSatang, totalSatang,
      changeSatang: input.payment.method === "cash" ? input.payment.cashReceivedSatang - totalSatang : 0 };
  });
  const summary = input.memberId ? await getMemberSummary(session.shopId, input.memberId) : null;
  if (summary && rewardsCreated > 0) {
    for (let i = 0; i < rewardsCreated; i++) {
      void pushRewardUnlocked(session.shopId, summary.id).catch((err) => logger.error({ err, shopId: session.shopId, memberId: summary.id }, "Reward notification failed"));
    }
  }
  return { ...result, subtotalSatang, stampsEarned: input.memberId ? stampsEarned : 0, rewardsCreated, member: summary };
}

export type OrderSummary = { id: string; dailyNo: number; status: "open" | "paid" | "void"; totalSatang: number;
  paymentMethod: "cash" | "promptpay" | null; memberName: string | null; staffName: string | null; itemCount: number; paidAt: Date | null };

export async function listOrdersForDay(shopId: string, date: string): Promise<OrderSummary[]> {
  const rows = await db.select({ id: orders.id, dailyNo: orders.dailyNo, status: orders.status,
    totalSatang: orders.totalSatang, paymentMethod: payments.method, memberName: members.displayName,
    staffName: staff.name, itemCount: sql<number>`coalesce(sum(${orderItems.qty}), 0)`, paidAt: orders.paidAt })
    .from(orders).leftJoin(payments, eq(payments.orderId, orders.id))
    .leftJoin(members, and(eq(members.id, orders.memberId), eq(members.shopId, shopId)))
    .leftJoin(staff, and(eq(staff.id, orders.staffId), eq(staff.shopId, shopId)))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.shopId, shopId), eq(orders.businessDate, date)))
    .groupBy(orders.id, payments.method, members.displayName, staff.name)
    .orderBy(desc(orders.createdAt));
  return rows.map((row) => ({ ...row, status: row.status as OrderSummary["status"],
    paymentMethod: row.paymentMethod as OrderSummary["paymentMethod"], itemCount: Number(row.itemCount) }));
}

export type OrderDetail = OrderSummary & { subtotalSatang: number; discountSatang: number; cashReceivedSatang: number | null;
  items: { name: string; qty: number; unitPriceSatang: number; note: string | null; modifiers: { name: string; priceDeltaSatang: number }[] }[];
  voidedAt: Date | null; businessDate: string; shopName: string; receiptFooter: string | null };

export async function getOrder(shopId: string, orderId: string): Promise<OrderDetail | null> {
  const [order] = await db.select({ id: orders.id, dailyNo: orders.dailyNo, status: orders.status,
    totalSatang: orders.totalSatang, subtotalSatang: orders.subtotalSatang, discountSatang: orders.discountSatang,
    paidAt: orders.paidAt, voidedAt: orders.voidedAt, businessDate: orders.businessDate, shopName: shops.name,
    receiptFooter: shops.receiptFooter, memberName: members.displayName, staffName: staff.name,
    paymentMethod: payments.method, cashReceivedSatang: payments.cashReceivedSatang })
    .from(orders).innerJoin(shops, eq(shops.id, orders.shopId))
    .leftJoin(members, and(eq(members.id, orders.memberId), eq(members.shopId, shopId)))
    .leftJoin(staff, and(eq(staff.id, orders.staffId), eq(staff.shopId, shopId)))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(orders.id, orderId), eq(orders.shopId, shopId))).limit(1);
  if (!order) return null;
  const itemRows = await db.select({ id: orderItems.id, name: orderItems.nameSnapshot, qty: orderItems.qty,
    unitPriceSatang: orderItems.unitPriceSatang, note: orderItems.note }).from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const modifierRows = itemRows.length ? await db.select({ orderItemId: orderItemModifiers.orderItemId,
    name: orderItemModifiers.nameSnapshot, priceDeltaSatang: orderItemModifiers.priceDeltaSatang })
    .from(orderItemModifiers).where(inArray(orderItemModifiers.orderItemId, itemRows.map(({ id }) => id))) : [];
  const items = itemRows.map(({ id, ...item }) => ({ ...item, modifiers: modifierRows
    .filter((modifier) => modifier.orderItemId === id).map(({ name, priceDeltaSatang }) => ({ name, priceDeltaSatang })) }));
  return { ...order, status: order.status as OrderSummary["status"],
    paymentMethod: order.paymentMethod as OrderSummary["paymentMethod"], itemCount: items.reduce((count, item) => count + item.qty, 0), items };
}

export async function voidOrder(shopId: string, orderId: string, managerStaffId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ id: orders.id, memberId: orders.memberId, staffId: orders.staffId })
      .from(orders).where(and(eq(orders.id, orderId), eq(orders.shopId, shopId), eq(orders.status, "paid"))).limit(1);
    if (!order) throw new Error("Paid order not found");
    const [manager] = await tx.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, managerStaffId), eq(staff.shopId, shopId), inArray(staff.role, ["owner", "manager"]), eq(staff.isActive, true))).limit(1);
    if (!manager) throw new Error("Manager not found");
    await tx.update(orders).set({ status: "void", voidedAt: new Date(), voidedBy: managerStaffId })
      .where(and(eq(orders.id, orderId), eq(orders.shopId, shopId), eq(orders.status, "paid")));
    if (order.memberId) {
      const [earned] = await tx.select({ total: sql<number>`coalesce(sum(${stampLedger.delta}), 0)` })
        .from(stampLedger).where(and(eq(stampLedger.shopId, shopId), eq(stampLedger.memberId, order.memberId),
          eq(stampLedger.orderId, orderId), eq(stampLedger.reason, "earn")));
      const availableRewards = await tx.select({ id: rewards.id }).from(rewards)
        .where(and(eq(rewards.shopId, shopId), eq(rewards.memberId, order.memberId),
          eq(rewards.earnedOrderId, orderId), eq(rewards.status, "available")));
      const [shop] = await tx.select({ stampGoal: shops.stampGoal }).from(shops).where(eq(shops.id, shopId)).limit(1);
      const compensation = -Number(earned?.total ?? 0) + (shop?.stampGoal ?? 0) * availableRewards.length;
      await tx.insert(stampLedger).values({ shopId, memberId: order.memberId, orderId, delta: compensation,
        reason: "adjust", staffId: managerStaffId });
      if (availableRewards.length) await tx.update(rewards).set({ status: "expired" })
        .where(and(eq(rewards.shopId, shopId), eq(rewards.memberId, order.memberId),
          eq(rewards.earnedOrderId, orderId), eq(rewards.status, "available")));
      await tx.update(rewards).set({ status: "available", redeemedOrderId: null })
        .where(and(eq(rewards.shopId, shopId), eq(rewards.redeemedOrderId, orderId), eq(rewards.status, "redeemed")));
    }
    await tx.insert(auditLog).values({ shopId, actor: managerStaffId, action: "orders.void",
      payload: { orderId } });
  });
}
