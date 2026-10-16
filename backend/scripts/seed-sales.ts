import { config } from "dotenv";
import { and, eq, inArray, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { members, orderItemModifiers, orderItems, orders, payments, products, rewards, shops, stampLedger, staff } from "../src/db/schema";

config({ path: "../frontend/.env.local" });

const seedMarker = "demo-sales-seed:v1";
const timezone = "Asia/Bangkok";
const demoPhones = Array.from({ length: 40 }, (_, index) => `09900000${String(index + 1).padStart(2, "0")}`);

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function dayKeys(endDate: string, count: number): string[] {
  const [year, month, day] = endDate.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (count - index - 1)));
    return date.toISOString().slice(0, 10);
  });
}

function paidAtFor(day: string): Date {
  const hourOptions = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const weights = [4, 6, 5, 4, 7, 9, 8, 6, 3, 2, 1, 1];
  const weightedHours = hourOptions.flatMap((hour, index) => Array(weights[index]).fill(hour));
  const hour = weightedHours[Math.floor(Math.random() * weightedHours.length)];
  const minute = Math.floor(Math.random() * 60);
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, hour - 7, minute));
}

function memberCreatedAtFor(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  // Created after the demo shop's 07:00–18:00 sales window.
  return new Date(Date.UTC(year, month - 1, date, 12));
}

async function seedSales() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL in .env.local.");
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    const [shop] = await db.select({ id: shops.id, stampGoal: shops.stampGoal }).from(shops)
      .where(eq(shops.slug, "demo-cafe")).limit(1);
    if (!shop) throw new Error("Run pnpm db:seed first (demo-cafe not found).");

    if (process.argv.includes("--reset")) {
      await db.transaction(async (tx) => {
        const seedOrderRows = await tx.selectDistinct({ id: orders.id }).from(orders)
          .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
          .where(and(eq(orders.shopId, shop.id), eq(orderItems.note, seedMarker)));
        const seedOrderIds = seedOrderRows.map(({ id }) => id);
        const demoMemberRows = await tx.select({ id: members.id }).from(members)
          .where(and(eq(members.shopId, shop.id), inArray(members.phone, demoPhones)));
        const demoMemberIds = demoMemberRows.map(({ id }) => id);

        if (seedOrderIds.length) {
          const seedItemRows = await tx.select({ id: orderItems.id }).from(orderItems)
            .where(inArray(orderItems.orderId, seedOrderIds));
          const seedItemIds = seedItemRows.map(({ id }) => id);
          if (seedItemIds.length) await tx.delete(orderItemModifiers).where(inArray(orderItemModifiers.orderItemId, seedItemIds));
          await tx.delete(payments).where(inArray(payments.orderId, seedOrderIds));
          await tx.delete(stampLedger).where(inArray(stampLedger.orderId, seedOrderIds));
          await tx.delete(rewards).where(and(eq(rewards.shopId, shop.id),
            // Rewards may be earned by one seed order and redeemed by another.
            // Delete the union of both references before deleting either order.
            inArray(rewards.earnedOrderId, seedOrderIds)));
          await tx.delete(rewards).where(and(eq(rewards.shopId, shop.id),
            inArray(rewards.redeemedOrderId, seedOrderIds)));
          await tx.delete(orders).where(inArray(orders.id, seedOrderIds));
        }

        if (demoMemberIds.length) {
          // The demo members are script-owned; remove any remaining script history before them.
          await tx.delete(stampLedger).where(and(eq(stampLedger.shopId, shop.id), inArray(stampLedger.memberId, demoMemberIds)));
          await tx.delete(rewards).where(and(eq(rewards.shopId, shop.id), inArray(rewards.memberId, demoMemberIds)));
          await tx.delete(members).where(and(eq(members.shopId, shop.id), inArray(members.id, demoMemberIds)));
        }
      });
      console.info("Demo sales and demo members reset.");
      return;
    }

    const existingSeedOrder = await db.select({ id: orders.id }).from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.shopId, shop.id), eq(orderItems.note, seedMarker))).limit(1);
    if (existingSeedOrder.length) {
      console.info("Demo sales already seeded; skipped.");
      return;
    }

    const occupiedDemoPhone = await db.select({ id: members.id, phone: members.phone }).from(members)
      .where(and(eq(members.shopId, shop.id), inArray(members.phone, demoPhones))).limit(1);
    if (occupiedDemoPhone.length) {
      throw new Error(`Reserved demo member phone is already in use: ${occupiedDemoPhone[0].phone}. Run --reset first if this is stale demo data.`);
    }

    const activeProducts = await db.select({ id: products.id, name: products.name, price: products.basePriceSatang,
      earnsStamp: products.earnsStamp }).from(products)
      .where(and(eq(products.shopId, shop.id), eq(products.isActive, true)));
    if (!activeProducts.length) throw new Error("Add active products to demo-cafe before seeding sales.");
    const activeStaff = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.shopId, shop.id), eq(staff.isActive, true)));
    const today = dateKey(new Date());
    const days = dayKeys(today, 30);
    const memberDays = dayKeys(today, 40);
    const demoMembers = demoPhones.map((phone, index) => ({
      phone,
      displayName: `ลูกค้าทดลอง ${String(index + 1).padStart(2, "0")}`,
      createdAt: memberCreatedAtFor(memberDays[Math.floor(index * memberDays.length / demoPhones.length)]),
    }));
    let orderCount = 0;
    let voidCount = 0;
    let rewardsCreated = 0;
    let rewardsRedeemed = 0;

    await db.transaction(async (tx) => {
      const insertedMembers = await tx.insert(members).values(demoMembers.map((member) => ({
        shopId: shop.id,
        phone: member.phone,
        displayName: member.displayName,
        lineUserId: null,
        createdAt: member.createdAt,
        consentAt: member.createdAt,
      }))).returning({ id: members.id, phone: members.phone, createdAt: members.createdAt });
      const demoMembersWithIds = insertedMembers.map((member) => ({ ...member, balance: 0,
        availableRewards: [] as { id: string; earnedAt: Date; redeemLater: boolean }[] }));

      for (const businessDate of days) {
        const [maxRow] = await tx.select({ dailyNo: max(orders.dailyNo) }).from(orders)
          .where(and(eq(orders.shopId, shop.id), eq(orders.businessDate, businessDate)));
        let dailyNo = (maxRow.dailyNo ?? 0) + 1;
        const count = 20 + Math.floor(Math.random() * 41);
        const planned = Array.from({ length: count }, () => {
          const lineCount = 1 + Math.floor(Math.random() * 3);
          const lines = Array.from({ length: lineCount }, () => {
            const product = activeProducts[Math.floor(Math.random() * activeProducts.length)];
            return { product, qty: 1 + Math.floor(Math.random() * 2) };
          });
          const subtotalSatang = lines.reduce((total, line) => total + line.product.price * line.qty, 0);
          const paidAt = paidAtFor(businessDate);
          const isVoid = Math.random() < 0.025;
          const eligibleMembers = isVoid ? [] : demoMembersWithIds.filter((member) => member.createdAt < paidAt);
          const member = eligibleMembers.length && Math.random() < 0.35
            ? eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)]
            : null;
          return { businessDate, status: isVoid ? "void" as const : "paid" as const, member,
            staffId: activeStaff.length ? activeStaff[Math.floor(Math.random() * activeStaff.length)].id : null,
            subtotalSatang, paidAt,
            voidedAt: isVoid ? new Date(paidAt.getTime() + 5 * 60_000) : null, lines };
        }).sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
        for (const order of planned) {
          const eligibleLines = order.lines.filter(({ product }) => product.earnsStamp);
          const reward = order.member?.availableRewards.find(({ earnedAt, redeemLater }) =>
            redeemLater && earnedAt < order.paidAt);
          const redeemReward = eligibleLines.length && reward ? reward : null;
          const discountSatang = redeemReward
            ? Math.min(order.subtotalSatang, Math.min(...eligibleLines.map(({ product }) => product.price)))
            : 0;
          const totalSatang = Math.max(0, order.subtotalSatang - discountSatang);
          const [inserted] = await tx.insert(orders).values({
            shopId: shop.id,
            dailyNo: dailyNo++,
            businessDate: order.businessDate,
            status: order.status,
            memberId: order.member?.id ?? null,
            staffId: order.staffId,
            subtotalSatang: order.subtotalSatang,
            discountSatang,
            totalSatang,
            paidAt: order.paidAt,
            voidedAt: order.voidedAt,
          }).returning({ id: orders.id });
          await tx.insert(orderItems).values(order.lines.map(({ product, qty }) => ({
            orderId: inserted.id,
            productId: product.id,
            nameSnapshot: product.name,
            unitPriceSatang: product.price,
            qty,
            note: seedMarker,
          })));
          await tx.insert(payments).values({
            orderId: inserted.id,
            method: Math.random() < 0.7 ? "cash" as const : "promptpay" as const,
            amountSatang: totalSatang,
            cashReceivedSatang: null,
            confirmedBy: order.staffId,
          });

          if (order.member && order.status === "paid") {
            if (redeemReward) {
              await tx.update(rewards).set({ status: "redeemed", redeemedOrderId: inserted.id })
                .where(and(eq(rewards.id, redeemReward.id), eq(rewards.status, "available")));
              order.member.availableRewards = order.member.availableRewards.filter(({ id }) => id !== redeemReward.id);
              rewardsRedeemed++;
            }
            const earned = order.lines.reduce((total, line) => total + (line.product.earnsStamp ? line.qty : 0), 0);
            if (earned > 0) {
              await tx.insert(stampLedger).values({ shopId: shop.id, memberId: order.member.id,
                orderId: inserted.id, delta: earned, reason: "earn", staffId: order.staffId,
                createdAt: order.paidAt });
              order.member.balance += earned;
            }
            while (order.member.balance >= shop.stampGoal) {
              await tx.insert(stampLedger).values({ shopId: shop.id, memberId: order.member.id,
                orderId: inserted.id, delta: -shop.stampGoal, reason: "redeem", staffId: order.staffId,
                createdAt: order.paidAt });
              order.member.balance -= shop.stampGoal;
              const [createdReward] = await tx.insert(rewards).values({ shopId: shop.id,
                memberId: order.member.id, earnedOrderId: inserted.id }).returning({ id: rewards.id });
              order.member.availableRewards.push({ id: createdReward.id, earnedAt: order.paidAt,
                // Some rewards are earned near the end of the seed window and have fewer chances to be used.
                redeemLater: Math.random() < 0.56 });
              rewardsCreated++;
            }
          }
          orderCount++;
          if (order.status === "void") voidCount++;
        }
      }
    });

    console.info(`Demo sales seeded: ${orderCount} orders across ${days.length} days (${voidCount} voids, ${rewardsCreated} rewards, ${rewardsRedeemed} redeemed).`);
  } finally {
    await client.end();
  }
}

seedSales().catch((error: unknown) => {
  console.error("Demo sales seed failed:", error);
  process.exitCode = 1;
});
