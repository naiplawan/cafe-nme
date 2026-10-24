import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, shops, staff } from "@/db/schema";
import { adjustStamps, getMemberSummary, listLedger } from "./loyalty";

describe("loyalty integration", () => {
  const slug = `loyalty-test-${randomUUID()}`;
  let shopId: string;
  let staffId: string;
  let memberId: string;

  beforeAll(async () => {
    const [shop] = await db.insert(shops).values({ name: "Loyalty Test", slug, stampGoal: 3 }).returning();
    shopId = shop.id;
    const [staffRow] = await db.insert(staff).values({ shopId, name: "Tester", role: "manager" }).returning();
    staffId = staffRow.id;
    const [member] = await db.insert(members).values({ shopId, displayName: "สมาชิก" }).returning();
    memberId = member.id;
  });

  afterAll(async () => {
    if (shopId) await db.delete(shops).where(eq(shops.id, shopId));
  });

  it("adjusts a member balance and records the ledger and audit entry", async () => {
    const updated = await adjustStamps(shopId, memberId, 2, staffId, "แก้ไขยอด");
    expect(updated.stampBalance).toBe(2);
    expect((await getMemberSummary(shopId, memberId))?.stampBalance).toBe(2);
    expect(await listLedger(shopId, memberId)).toMatchObject([{ delta: 2, reason: "adjust", orderId: null }]);
  });

  it("returns null for a missing member through the HTTP API", async () => {
    await expect(getMemberSummary(shopId, randomUUID())).resolves.toBeNull();
  });
});
