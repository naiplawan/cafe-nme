import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { members, shops } from "@/db/schema";
import { createMemberToken } from "@/lib/member-token";
import { createMemberByPhone, deleteMemberData, findMemberByToken, findMembersByPhone } from "./members";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const shopSlugs = [`member-test-a-${suffix}`, `member-test-b-${suffix}`];
let shopIds: string[] = [];
let memberId = "";
let secondShopMemberId = "";

describe("members service integration", () => {
  beforeAll(async () => {
    const created = await db.insert(shops).values([
      { name: `Member Test A ${suffix}`, slug: shopSlugs[0] },
      { name: `Member Test B ${suffix}`, slug: shopSlugs[1] },
    ]).returning({ id: shops.id });
    shopIds = created.map((shop) => shop.id);
    const first = await createMemberByPhone(shopIds[0], "0812345678", "สมาชิกทดสอบ");
    const second = await createMemberByPhone(shopIds[1], "0812345678", "สมาชิกอีกร้าน");
    memberId = first.id;
    secondShopMemberId = second.id;
  });

  afterAll(async () => {
    if (shopIds.length) await db.delete(shops).where(inArray(shops.id, shopIds));
  });

  it("rejects a signed member token when used for another shop", async () => {
    const token = createMemberToken(memberId);
    expect(await findMemberByToken(shopIds[1], token)).toBeNull();
    expect(await findMemberByToken(shopIds[0], token)).toBe(memberId);
    expect(secondShopMemberId).not.toBe(memberId);
  });

  it("searches phone numbers by digits and prefix within the requested shop", async () => {
    const result = await findMembersByPhone(shopIds[0], "+66 81-23");
    expect(result.map((member) => member.id)).toContain(memberId);
    expect(result.map((member) => member.id)).not.toContain(secondShopMemberId);
  });

  it("rejects duplicate walk-in phones with a clear error", async () => {
    await expect(createMemberByPhone(shopIds[0], "0812345678", "ซ้ำ")).rejects.toThrow("เบอร์โทรนี้มีสมาชิกแล้ว");
  });

  it("anonymises member data without deleting the record", async () => {
    await deleteMemberData(shopIds[0], memberId);
    const [row] = await db.select().from(members).where(and(eq(members.shopId, shopIds[0]), eq(members.id, memberId)));
    expect(row).toMatchObject({ phone: null, lineUserId: null, displayName: "ลบข้อมูลแล้ว" });
    expect(row.deletedAt).toBeInstanceOf(Date);
  });
});
