import "server-only";
import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, rewards, stampLedger } from "@/db/schema";
import { verifyMemberToken } from "@/lib/member-token";

export type MemberRow = {
  id: string;
  displayName: string;
  phone: string | null;
  lineUserId: string | null;
  createdAt: Date;
  stampBalance: number;
};

const stampBalance = sql<number>`coalesce(sum(${stampLedger.delta}), 0)::int`;

export async function findMemberByToken(shopId: string, token: string): Promise<string | null> {
  const memberId = verifyMemberToken(token);
  if (!memberId) return null;
  const [row] = await db.select({ id: members.id }).from(members)
    .where(and(eq(members.shopId, shopId), eq(members.id, memberId), isNull(members.deletedAt))).limit(1);
  return row?.id ?? null;
}

// Digits only, with the Thai country code (+66 81…) mapped to the local form (081…).
function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("66") && digits.length > 2 ? `0${digits.slice(2)}` : digits;
}

export async function findMembersByPhone(shopId: string, phoneQuery: string): Promise<MemberRow[]> {
  const digits = phoneDigits(phoneQuery);
  if (!digits) return [];
  return db.select({
    id: members.id,
    displayName: members.displayName,
    phone: members.phone,
    lineUserId: members.lineUserId,
    createdAt: members.createdAt,
    stampBalance,
  }).from(members)
    .leftJoin(stampLedger, and(eq(stampLedger.memberId, members.id), eq(stampLedger.shopId, shopId)))
    .where(and(eq(members.shopId, shopId), isNull(members.deletedAt), or(eq(members.phone, digits), like(members.phone, `${digits}%`))))
    .groupBy(members.id).orderBy(members.phone).limit(10);
}

// Duplicate walk-in phones are rejected so a POS operator must select the existing member.
export async function createMemberByPhone(shopId: string, phone: string, displayName: string): Promise<MemberRow> {
  const digits = phoneDigits(phone);
  const [existing] = await db.select({ id: members.id }).from(members)
    .where(and(eq(members.shopId, shopId), eq(members.phone, digits), isNull(members.deletedAt))).limit(1);
  if (existing) throw new Error("เบอร์โทรนี้มีสมาชิกแล้ว");
  const [row] = await db.insert(members).values({ shopId, phone: digits, displayName }).returning({
    id: members.id, displayName: members.displayName, phone: members.phone,
    lineUserId: members.lineUserId, createdAt: members.createdAt,
  });
  return { ...row, stampBalance: 0 };
}

export async function listMembers(shopId: string, opts: { search?: string; limit?: number; offset?: number; availableReward?: boolean } = {}): Promise<{ rows: MemberRow[]; total: number }> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const offset = Math.max(0, opts.offset ?? 0);
  const search = opts.search?.trim();
  const digits = search ? phoneDigits(search) : "";
  const filter = and(eq(members.shopId, shopId), isNull(members.deletedAt), search
    ? or(like(members.displayName, `%${search}%`), ...(digits ? [like(members.phone, `%${digits}%`)] : []))
    : undefined, opts.availableReward
      ? sql`exists (select 1 from ${rewards} where ${rewards.memberId} = ${members.id} and ${rewards.shopId} = ${shopId} and ${rewards.status} = 'available')`
      : undefined);
  const [rows, count] = await Promise.all([
    db.select({ id: members.id, displayName: members.displayName, phone: members.phone,
      lineUserId: members.lineUserId, createdAt: members.createdAt, stampBalance })
      .from(members).leftJoin(stampLedger, and(eq(stampLedger.memberId, members.id), eq(stampLedger.shopId, shopId)))
      .where(filter).groupBy(members.id).orderBy(members.createdAt).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(members).where(filter),
  ]);
  return { rows, total: count[0]?.total ?? 0 };
}

export async function deleteMemberData(shopId: string, memberId: string): Promise<void> {
  await db.update(members).set({ phone: null, lineUserId: null, displayName: "ลบข้อมูลแล้ว", deletedAt: new Date() })
    .where(and(eq(members.shopId, shopId), eq(members.id, memberId)));
}
