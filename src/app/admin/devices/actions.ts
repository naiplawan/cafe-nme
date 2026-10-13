"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/db";
import { posDevices } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { createDevice, regeneratePairingCode } from "@/server/pos-session";

export type DeviceActionState = { message: string | null; code?: string; expiresAt?: string; pairUrl?: string; qrDataUrl?: string };
const empty: DeviceActionState = { message: null };
async function allowed() {
  const session = await requireStaff();
  return { ...session, permitted: session.staff.role === "owner" || session.staff.role === "manager" };
}
const field = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function pairingDetails(code: string) {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")}`;
  const pairUrl = `${origin}/pos/pair`;
  const qrDataUrl = await QRCode.toDataURL(`${pairUrl}?code=${encodeURIComponent(code)}`, { width: 220, margin: 1 });
  return { code, pairUrl, qrDataUrl, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
}

export async function createDeviceAction(_state: DeviceActionState, data: FormData): Promise<DeviceActionState> {
  const session = await allowed();
  if (!session.permitted) return { message: "ไม่มีสิทธิ์" };
  const name = field(data, "name");
  if (!name || name.length > 80) return { message: "กรุณาระบุชื่อเครื่อง" };
  const result = await createDevice(session.shopId, name);
  revalidatePath("/admin/devices");
  return { ...empty, ...await pairingDetails(result.pairingCode) };
}

export async function regenerateDeviceCodeAction(deviceId: string, _state: DeviceActionState, _data: FormData): Promise<DeviceActionState> {
  void _state;
  void _data;
  const session = await allowed();
  if (!session.permitted) return { message: "ไม่มีสิทธิ์" };
  try {
    const code = await regeneratePairingCode(session.shopId, deviceId);
    revalidatePath("/admin/devices");
    return { ...empty, ...await pairingDetails(code) };
  } catch {
    return { message: "ไม่พบเครื่อง POS" };
  }
}

export async function removeDeviceAction(deviceId: string, _state: DeviceActionState, _data: FormData): Promise<DeviceActionState> {
  void _state;
  void _data;
  const session = await allowed();
  if (!session.permitted) return { message: "ไม่มีสิทธิ์" };
  await db.delete(posDevices).where(and(eq(posDevices.shopId, session.shopId), eq(posDevices.id, deviceId)));
  revalidatePath("/admin/devices");
  return empty;
}
