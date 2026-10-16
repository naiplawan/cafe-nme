"use server";

import { redirect } from "next/navigation";
import { requirePosStaff, posLogout } from "@/server/pos-session";
import { findMemberByToken, findMembersByPhone } from "@/server/members";
import { getMemberSummary, type MemberSummary } from "@/server/loyalty";

export async function lookupMemberByQr(token: string): Promise<MemberSummary | null> {
  const session = await requirePosStaff();
  const memberId = await findMemberByToken(session.shopId, token.trim());
  return memberId ? getMemberSummary(session.shopId, memberId) : null;
}

export async function searchMembersByPhone(query: string): Promise<MemberSummary[]> {
  const session = await requirePosStaff();
  const digits = query.replace(/\D/g, "");
  if (digits.length < 4) return [];
  const members = await findMembersByPhone(session.shopId, digits);
  const summaries = await Promise.all(members.slice(0, 5).map((member) => getMemberSummary(session.shopId, member.id)));
  return summaries.filter((member): member is MemberSummary => member !== null);
}

export async function lookupMemberById(memberId: string): Promise<MemberSummary | null> {
  const session = await requirePosStaff();
  return getMemberSummary(session.shopId, memberId);
}

export async function getPosDeviceId(): Promise<string> {
  const session = await requirePosStaff();
  return session.deviceId;
}

export async function logoutPos(): Promise<never> {
  await requirePosStaff();
  await posLogout();
  redirect("/pos/login");
}
