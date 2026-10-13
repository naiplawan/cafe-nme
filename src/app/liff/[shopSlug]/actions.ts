"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, rewards, shops, stampLedger } from "@/db/schema";
import { createMemberToken } from "@/lib/member-token";
import { verifyLineIdToken } from "@/server/line";

export type MemberCardData = {
  member: { displayName: string; phone: string | null; stampBalance: number; stampGoal: number; availableRewards: number };
  qrToken: string;
};
export type MemberActionState = { message: string | null; success: boolean };

async function identify(shopSlug: string, idToken: string) {
  return verifyLineIdToken(shopSlug, idToken);
}

export async function getMyCard(shopSlug: string, idToken: string): Promise<{ registered: false } | { registered: true; member: MemberCardData["member"]; qrToken: string }> {
  const identity = await identify(shopSlug, idToken);
  if (!identity) return { registered: false };
  const [row] = await db.select({
    id: members.id, displayName: members.displayName, phone: members.phone,
    stampGoal: shops.stampGoal,
    stampBalance: sql<number>`coalesce(sum(${stampLedger.delta}), 0)::int`,
    availableRewards: sql<number>`(select count(*)::int from ${rewards} where ${rewards.shopId} = ${shops.id} and ${rewards.memberId} = ${members.id} and ${rewards.status} = 'available')`,
  }).from(members).innerJoin(shops, eq(shops.id, members.shopId))
    .leftJoin(stampLedger, and(eq(stampLedger.shopId, shops.id), eq(stampLedger.memberId, members.id)))
    .where(and(eq(shops.slug, shopSlug), eq(members.lineUserId, identity.lineUserId), isNull(members.deletedAt)))
    .groupBy(members.id, shops.id).limit(1);
  if (!row || !row.phone) return { registered: false };
  const member = { displayName: row.displayName, phone: row.phone, stampBalance: row.stampBalance, stampGoal: row.stampGoal, availableRewards: row.availableRewards };
  return { registered: true, member, qrToken: createMemberToken(row.id) };
}

export async function register(
  shopSlug: string,
  idToken: string,
  input: { phone: string; displayName: string; consent: boolean },
): Promise<MemberActionState> {
  const identity = await identify(shopSlug, idToken);
  if (!identity) return { message: "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่", success: false };
  if (!input.consent) return { message: "กรุณายินยอมให้ใช้ข้อมูลเพื่อสมัครสมาชิก", success: false };
  if (!/^0\d{9}$/.test(input.phone)) return { message: "กรุณากรอกเบอร์โทรศัพท์มือถือ 10 หลัก", success: false };
  const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, shopSlug)).limit(1);
  if (!shop) return { message: "ไม่พบร้าน", success: false };
  try {
    await db.insert(members).values({
      shopId: shop.id, lineUserId: identity.lineUserId, phone: input.phone,
      displayName: input.displayName.trim() || identity.name, consentAt: new Date(),
    }).onConflictDoUpdate({
      target: [members.shopId, members.lineUserId],
      set: { phone: input.phone, displayName: input.displayName.trim() || identity.name, consentAt: new Date(), deletedAt: null },
    });
    return { message: null, success: true };
  } catch {
    return { message: "เบอร์โทรนี้มีสมาชิกแล้ว กรุณาติดต่อที่ร้าน", success: false };
  }
}

export async function deleteMyData(shopSlug: string, idToken: string): Promise<MemberActionState> {
  const identity = await identify(shopSlug, idToken);
  if (!identity) return { message: "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่", success: false };
  const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, shopSlug)).limit(1);
  if (!shop) return { message: "ไม่พบร้าน", success: false };
  await db.update(members).set({ phone: null, lineUserId: null, displayName: "ลบข้อมูลแล้ว", deletedAt: new Date() })
    .where(and(eq(members.shopId, shop.id), eq(members.lineUserId, identity.lineUserId), isNull(members.deletedAt)));
  return { message: "ลบข้อมูลสมาชิกแล้ว", success: true };
}
