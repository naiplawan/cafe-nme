import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, members, orderItems, orders, payments, products, rewards, shops } from "@/db/schema";
import { categorySales, hourlySales, memberGrowth, memberOverview } from "@/server/reports";

const slug = `reports-viz-${crypto.randomUUID()}`;
let shopIds: string[] = [];

afterAll(async () => {
  if (shopIds.length) await db.delete(shops).where(eq(shops.id, shopIds[0]));
  if (shopIds.length > 1) await db.delete(shops).where(eq(shops.id, shopIds[1]));
});

describe("visualization report integration", () => {
  it("zero-fills Bangkok hour buckets, groups fallback categories, and isolates shops", async () => {
    const created = await db.insert(shops).values([
      { name: `${slug}-one`, slug: `${slug}-one` },
      { name: `${slug}-two`, slug: `${slug}-two` },
    ]).returning({ id: shops.id });
    shopIds = created.map(({ id }) => id);
    const [shopId, otherShopId] = shopIds;
    const [category] = await db.insert(categories).values({ shopId, name: "กาแฟ" }).returning({ id: categories.id });
    const [product] = await db.insert(products).values({
      shopId,
      categoryId: category.id,
      name: "ลาเต้",
      basePriceSatang: 5000,
    }).returning({ id: products.id });
    const createdMembers = await db.insert(members).values([
      { shopId, displayName: "ก่อนช่วง", phone: `${slug}-1`, lineUserId: "line-1", createdAt: new Date("2026-10-08T17:00:00.000Z") },
      { shopId, displayName: "สมาชิกใหม่", phone: `${slug}-2`, createdAt: new Date("2026-10-10T17:30:00.000Z") },
      { shopId, displayName: "ถูกลบ", phone: `${slug}-3`, deletedAt: new Date("2026-10-12T00:00:00.000Z"), createdAt: new Date("2026-10-11T17:00:00.000Z") },
    ]).returning({ id: members.id });
    const [member, laterMember] = createdMembers;
    const [lateNight, afterMidnight, voided, otherShopOrder] = await db.insert(orders).values([
      { shopId, dailyNo: 1, businessDate: "2026-10-10", status: "paid", memberId: member.id, subtotalSatang: 5000, totalSatang: 5000, paidAt: new Date("2026-10-10T16:00:00.000Z") },
      { shopId, dailyNo: 1, businessDate: "2026-10-11", status: "paid", memberId: laterMember.id, subtotalSatang: 7500, totalSatang: 7500, paidAt: new Date("2026-10-10T17:30:00.000Z") },
      { shopId, dailyNo: 1, businessDate: "2026-10-12", status: "void", subtotalSatang: 3000, totalSatang: 3000, paidAt: new Date("2026-10-12T03:00:00.000Z") },
      { shopId: otherShopId, dailyNo: 1, businessDate: "2026-10-10", status: "paid", subtotalSatang: 9000, totalSatang: 9000, paidAt: new Date("2026-10-10T16:00:00.000Z") },
    ]).returning({ id: orders.id });
    await db.insert(orderItems).values([
      { orderId: lateNight.id, productId: product.id, nameSnapshot: "ลาเต้", unitPriceSatang: 5000, qty: 1 },
      { orderId: afterMidnight.id, productId: product.id, nameSnapshot: "ลาเต้", unitPriceSatang: 5000, qty: 1 },
      { orderId: afterMidnight.id, nameSnapshot: "สินค้าลบแล้ว", unitPriceSatang: 2500, qty: 1 },
      { orderId: voided.id, productId: product.id, nameSnapshot: "ลาเต้", unitPriceSatang: 3000, qty: 1 },
      { orderId: otherShopOrder.id, productId: product.id, nameSnapshot: "ลาเต้", unitPriceSatang: 9000, qty: 1 },
    ]);
    await db.insert(payments).values([
      { orderId: lateNight.id, method: "cash", amountSatang: 5000 },
      { orderId: afterMidnight.id, method: "promptpay", amountSatang: 7500 },
      { orderId: otherShopOrder.id, method: "cash", amountSatang: 9000 },
    ]);
    await db.insert(rewards).values({ shopId, memberId: member.id, status: "available" });

    const hours = await hourlySales(shopId, "2026-10-10", "2026-10-12");
    expect(hours).toHaveLength(24);
    expect(hours[0]).toEqual({ hour: 0, orders: 1, netSatang: 7500 });
    expect(hours[6]).toEqual({ hour: 6, orders: 0, netSatang: 0 });
    expect(hours[23]).toEqual({ hour: 23, orders: 1, netSatang: 5000 });
    expect(hours.reduce((total, row) => total + row.orders, 0)).toBe(2);

    await expect(categorySales(shopId, "2026-10-10", "2026-10-12")).resolves.toEqual([
      { category: "กาแฟ", qty: 2, revenueSatang: 10_000 },
      { category: "อื่นๆ", qty: 1, revenueSatang: 2500 },
    ]);
    await expect(memberGrowth(shopId, "2026-10-10", "2026-10-12")).resolves.toEqual([
      { date: "2026-10-10", newMembers: 0, totalMembers: 1 },
      { date: "2026-10-11", newMembers: 1, totalMembers: 2 },
      { date: "2026-10-12", newMembers: 0, totalMembers: 2 },
    ]);
    await expect(memberOverview(shopId)).resolves.toEqual({ total: 2, lineLinked: 1, active30d: 2, rewardsAvailable: 1 });
  });
});
