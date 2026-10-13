import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, members, rewards, shops, stampLedger, staff } from "@/db/schema";

export type MemberSummary = { id: string; displayName: string; phone: string | null; lineLinked: boolean;
  stampBalance: number; stampGoal: number; availableRewards: { id: string; createdAt: Date }[] };

async function summarize(shopId: string, memberId: string, executor = db): Promise<MemberSummary | null> {
  const [member] = await executor.select({ id: members.id, displayName: members.displayName, phone: members.phone,
    lineUserId: members.lineUserId, stampGoal: shops.stampGoal })
    .from(members).innerJoin(shops, eq(shops.id, members.shopId))
    .where(and(eq(members.id, memberId), eq(members.shopId, shopId), isNull(members.deletedAt))).limit(1);
  if (!member) return null;
  const [balance] = await executor.select({ value: sql<number>`coalesce(sum(${stampLedger.delta}), 0)` })
    .from(stampLedger).where(and(eq(stampLedger.shopId, shopId), eq(stampLedger.memberId, memberId)));
  const availableRewards = await executor.select({ id: rewards.id, createdAt: rewards.createdAt })
    .from(rewards).where(and(eq(rewards.shopId, shopId), eq(rewards.memberId, memberId), eq(rewards.status, "available")))
    .orderBy(asc(rewards.createdAt));
  return { id: member.id, displayName: member.displayName, phone: member.phone, lineLinked: member.lineUserId !== null,
    stampBalance: Number(balance?.value ?? 0), stampGoal: member.stampGoal, availableRewards };
}

export async function getMemberSummary(shopId: string, memberId: string): Promise<MemberSummary | null> {
  return summarize(shopId, memberId);
}

export async function adjustStamps(shopId: string, memberId: string, delta: number, staffId: string, note?: string): Promise<MemberSummary> {
  if (!Number.isInteger(delta)) throw new Error("Stamp adjustment must be an integer");
  await db.transaction(async (tx) => {
    const [member] = await tx.select({ id: members.id }).from(members)
      .where(and(eq(members.id, memberId), eq(members.shopId, shopId), isNull(members.deletedAt))).limit(1);
    const [actor] = await tx.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.shopId, shopId))).limit(1);
    if (!member || !actor) throw new Error("Member or staff not found");
    await tx.insert(stampLedger).values({ shopId, memberId, delta, reason: "adjust", staffId });
    await tx.insert(auditLog).values({ shopId, actor: staffId, action: "stamps.adjust",
      payload: { memberId, delta, note: note?.trim() || null } });
  });
  const summary = await summarize(shopId, memberId);
  if (!summary) throw new Error("Member not found");
  return summary;
}

export async function listLedger(shopId: string, memberId: string, limit = 50): Promise<{ id: string; delta: number; reason: string; orderId: string | null; createdAt: Date }[]> {
  const rows = await db.select({ id: stampLedger.id, delta: stampLedger.delta, reason: stampLedger.reason,
    orderId: stampLedger.orderId, createdAt: stampLedger.createdAt })
    .from(stampLedger).innerJoin(members, and(eq(members.id, stampLedger.memberId), eq(members.shopId, shopId)))
    .where(and(eq(stampLedger.shopId, shopId), eq(stampLedger.memberId, memberId)))
    .orderBy(desc(stampLedger.createdAt)).limit(Math.max(0, Math.min(500, Math.trunc(limit))));
  return rows;
}
