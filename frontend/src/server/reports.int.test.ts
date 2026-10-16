import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  members,
  orderItems,
  orders,
  payments,
  rewards,
  shops,
  stampLedger,
} from "@/db/schema";
import { ordersForExport, salesSummary } from "@/server/reports";

const slug = `reports-${crypto.randomUUID()}`;
let shopId: string;

afterAll(async () => {
  if (shopId) await db.delete(shops).where(eq(shops.id, shopId));
});

describe("reports integration", () => {
  it("counts paid orders and excludes void orders from sales and export", async () => {
    const [shop] = await db.insert(shops).values({ name: slug, slug }).returning({ id: shops.id });
    shopId = shop.id;
    const [member] = await db
      .insert(members)
      .values({ shopId, displayName: "ทดสอบรายงาน", phone: "0812345678", createdAt: new Date("2026-10-13T03:00:00.000Z") })
      .returning({ id: members.id });
    const [first, second, voided] = await db
      .insert(orders)
      .values([
        { shopId, dailyNo: 1, businessDate: "2026-10-13", status: "paid", memberId: member.id, subtotalSatang: 10_000, discountSatang: 1000, totalSatang: 9000, paidAt: new Date("2026-10-13T04:00:00.000Z") },
        { shopId, dailyNo: 2, businessDate: "2026-10-13", status: "paid", subtotalSatang: 5000, discountSatang: 0, totalSatang: 5000, paidAt: new Date("2026-10-13T05:00:00.000Z") },
        { shopId, dailyNo: 3, businessDate: "2026-10-13", status: "void", subtotalSatang: 4000, discountSatang: 0, totalSatang: 4000 },
      ])
      .returning({ id: orders.id });

    await db.insert(orderItems).values([
      { orderId: first.id, nameSnapshot: "ลาเต้", unitPriceSatang: 5000, qty: 2 },
      { orderId: second.id, nameSnapshot: "ชาไทย", unitPriceSatang: 5000, qty: 1 },
      { orderId: voided.id, nameSnapshot: "กาแฟ", unitPriceSatang: 4000, qty: 1 },
    ]);
    await db.insert(payments).values([
      { orderId: first.id, method: "cash", amountSatang: 9000 },
      { orderId: second.id, method: "promptpay", amountSatang: 5000 },
    ]);
    await db.insert(stampLedger).values({ shopId, memberId: member.id, orderId: first.id, delta: 2, reason: "earn" });
    await db.insert(rewards).values({ shopId, memberId: member.id, status: "redeemed", redeemedOrderId: second.id });

    await expect(salesSummary(shopId, "2026-10-13", "2026-10-13")).resolves.toMatchObject({
      orders: 2,
      voided: 1,
      grossSatang: 15_000,
      discountSatang: 1000,
      netSatang: 14_000,
      cups: 3,
      byMethod: { cash: 9000, promptpay: 5000 },
      memberOrders: 1,
      stampsIssued: 2,
      rewardsRedeemed: 1,
      newMembers: 1,
    });
    const exportRows = await ordersForExport(shopId, "2026-10-13", "2026-10-13");
    expect(exportRows).toHaveLength(2);
    expect(exportRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ orderNo: 1, grossSatang: 10_000, discountSatang: 1000, netSatang: 9000, cups: 2 }),
      expect.objectContaining({ orderNo: 2, grossSatang: 5000, discountSatang: 0, netSatang: 5000, cups: 1 }),
    ]));
  });
});
