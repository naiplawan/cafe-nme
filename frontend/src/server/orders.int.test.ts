import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, members, modifierGroups, modifiers, productModifierGroups, products, rewards, shops, staff, stampLedger } from "@/db/schema";
import { checkout, voidOrder, type CheckoutError } from "./orders";
import { getOrder } from "./orders";
import { getMemberSummary } from "./loyalty";

describe("orders integration", () => {
  const slug = `orders-test-${randomUUID()}`;
  let shopId: string;
  let staffId: string;
  let productId: string;
  let modifierId: string;
  let memberId: string;
  let unlockedRewardId: string;

  beforeAll(async () => {
    const [shop] = await db.insert(shops).values({ name: "Orders Test", slug, stampGoal: 3, receiptFooter: "ขอบคุณ" }).returning();
    shopId = shop.id;
    const [staffRow] = await db.insert(staff).values({ shopId, name: "Tester", role: "manager" }).returning();
    staffId = staffRow.id;
    const [category] = await db.insert(categories).values({ shopId, name: "กาแฟ" }).returning();
    const [group] = await db.insert(modifierGroups).values({ shopId, name: "ขนาด", minSelect: 0, maxSelect: 1 }).returning();
    const [modifier] = await db.insert(modifiers).values({ groupId: group.id, name: "ใหญ่", priceDeltaSatang: 1000 }).returning();
    modifierId = modifier.id;
    const [product] = await db.insert(products).values({ shopId, categoryId: category.id, name: "ลาเต้", basePriceSatang: 5000 }).returning();
    productId = product.id;
    await db.insert(productModifierGroups).values({ productId, groupId: group.id });
    const [member] = await db.insert(members).values({ shopId, displayName: "สมาชิก", phone: `08${Date.now().toString().slice(-8)}` }).returning();
    memberId = member.id;
  });

  afterAll(async () => {
    if (shopId) await db.delete(shops).where(eq(shops.id, shopId));
  });

  it("rejects a client-supplied price instead of trusting it", async () => {
    await expect(checkout({ shopId, staffId }, { lines: [{ productId, qty: 1, modifierIds: [], unitPriceSatang: 1 } as never],
      payment: { method: "promptpay" } })).rejects.toThrow("400");
  });

  it("reprices from the database, numbers daily orders, gives change, and earns stamps/reward", async () => {
    const result = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 3, modifierIds: [modifierId], note: "  ไม่หวาน " }], memberId,
      payment: { method: "cash", cashReceivedSatang: 20_000 } });
    expect(result.subtotalSatang).toBe(18_000);
    expect(result.dailyNo).toBeGreaterThan(0);
    expect(result.changeSatang).toBe(2000);
    expect(result.stampsEarned).toBe(3);
    expect(result.rewardsCreated).toBe(1);
    unlockedRewardId = result.member!.availableRewards[0].id;
    const detail = await getOrder(shopId, result.orderId);
    expect(detail?.items[0]).toMatchObject({ unitPriceSatang: 6000, note: "ไม่หวาน" });
    expect(detail?.shopName).toBe("Orders Test");
    expect(detail?.receiptFooter).toBe("ขอบคุณ");
    const next = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 1, modifierIds: [] }],
      payment: { method: "promptpay" } });
    expect(next.dailyNo).toBe(result.dailyNo + 1);
  });

  it("rejects insufficient cash", async () => {
    await expect(checkout({ shopId, staffId }, { lines: [{ productId, qty: 1, modifierIds: [] }],
      payment: { method: "cash", cashReceivedSatang: 1 } })).rejects.toMatchObject<Partial<CheckoutError>>({ code: "cash_insufficient" });
  });

  it("rejects a member owned by another shop", async () => {
    const otherSlug = `${slug}-other`;
    const [other] = await db.insert(shops).values({ name: "Other", slug: otherSlug }).returning();
    try {
      const [otherStaff] = await db.insert(staff).values({ shopId: other.id, name: "Other tester" }).returning();
      const [otherProduct] = await db.insert(products).values({ shopId: other.id, name: "ชา", basePriceSatang: 4000 }).returning();
      await expect(checkout({ shopId: other.id, staffId: otherStaff.id }, { lines: [{ productId: otherProduct.id, qty: 1, modifierIds: [] }], memberId,
        payment: { method: "promptpay" } })).rejects.toMatchObject({ code: "member_not_found" });
    } finally {
      await db.delete(shops).where(eq(shops.id, other.id));
    }
  });

  it("voids paid orders and restores/cancels rewards as applicable", async () => {
    const earned = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 3, modifierIds: [] }], memberId,
      payment: { method: "promptpay" } });
    const redeem = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 1, modifierIds: [] }], memberId,
      redeemRewardId: earned.member!.availableRewards[0].id, payment: { method: "promptpay" } });
    expect(redeem.discountSatang).toBe(5000);
    await voidOrder(shopId, redeem.orderId, staffId);
    await voidOrder(shopId, earned.orderId, staffId);
    const detail = await getOrder(shopId, earned.orderId);
    expect(detail?.status).toBe("void");
    const summary = await getMemberSummary(shopId, memberId);
    expect(summary?.availableRewards.map((reward) => reward.id)).toContain(unlockedRewardId);
    const [earnedReward] = await db.select({ status: rewards.status }).from(rewards)
      .where(eq(rewards.earnedOrderId, earned.orderId));
    expect(earnedReward.status).toBe("expired");
  });

  it("keeps an earning order paid while its reward redemption is still paid", async () => {
    const earned = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 3, modifierIds: [] }], memberId,
      payment: { method: "promptpay" } });
    // Earlier tests leave other rewards available; redeem the one this order earned.
    const [earnedReward] = await db.select({ id: rewards.id }).from(rewards).where(eq(rewards.earnedOrderId, earned.orderId));
    const rewardId = earnedReward.id;
    const redemption = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 1, modifierIds: [] }], memberId,
      redeemRewardId: rewardId, payment: { method: "promptpay" } });

    await expect(voidOrder(shopId, earned.orderId, staffId)).rejects.toMatchObject({ code: "reward_redemption_active" });

    expect((await getOrder(shopId, earned.orderId))?.status).toBe("paid");
    expect((await getOrder(shopId, redemption.orderId))?.status).toBe("paid");
    const [reward] = await db.select({ status: rewards.status, redeemedOrderId: rewards.redeemedOrderId }).from(rewards)
      .where(eq(rewards.id, rewardId));
    expect(reward).toMatchObject({ status: "redeemed", redeemedOrderId: redemption.orderId });
  });

  it("reverses the stamp deltas that were recorded even if the stamp goal changed", async () => {
    const [before] = await db.select({ total: sql<string>`coalesce(sum(${stampLedger.delta}), 0)` }).from(stampLedger)
      .where(eq(stampLedger.memberId, memberId));
    const baseline = Number(before.total);
    const earned = await checkout({ shopId, staffId }, { lines: [{ productId, qty: 3, modifierIds: [] }], memberId,
      payment: { method: "promptpay" } });
    await db.update(shops).set({ stampGoal: 5 }).where(eq(shops.id, shopId));

    await voidOrder(shopId, earned.orderId, staffId);

    const [after] = await db.select({ total: sql<string>`coalesce(sum(${stampLedger.delta}), 0)` }).from(stampLedger)
      .where(eq(stampLedger.memberId, memberId));
    await db.update(shops).set({ stampGoal: 3 }).where(eq(shops.id, shopId));
    expect(Number(after.total)).toBe(baseline);
  });
});
