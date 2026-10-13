import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { posDevices, shops, staff } from "@/db/schema";
import { sign, unsign } from "@/lib/signing";
import { verifyPin } from "@/lib/pin";

const DEVICE_COOKIE = "pos_device";
const STAFF_COOKIE = "pos_staff";
const DEVICE_AGE = 365 * 24 * 60 * 60;
const STAFF_AGE = 12 * 60 * 60;

export type PosShop = {
  id: string;
  name: string;
  promptpayId: string | null;
  stampGoal: number;
  receiptFooter: string | null;
};
export type PosDevice = { deviceId: string; deviceName: string; shop: PosShop };
export type PosSession = PosDevice & {
  shopId: string;
  staff: { id: string; name: string; role: "owner" | "manager" | "barista" };
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newPairingCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");
const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function createDevice(
  shopId: string,
  name: string,
): Promise<{ deviceId: string; pairingCode: string }> {
  const pairingCode = newPairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const [device] = await db
    .insert(posDevices)
    .values({ shopId, name, pairingCodeHash: sha256(pairingCode), pairingExpiresAt: expiresAt })
    .returning({ id: posDevices.id });
  return { deviceId: device.id, pairingCode };
}

export async function regeneratePairingCode(shopId: string, deviceId: string): Promise<string> {
  const pairingCode = newPairingCode();
  const changed = await db
    .update(posDevices)
    .set({ pairingCodeHash: sha256(pairingCode), pairingExpiresAt: new Date(Date.now() + 10 * 60 * 1000) })
    .where(and(eq(posDevices.shopId, shopId), eq(posDevices.id, deviceId)))
    .returning({ id: posDevices.id });
  if (changed.length === 0) throw new Error("POS device not found");
  return pairingCode;
}

export async function pairDevice(code: string): Promise<PosDevice | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const deviceToken = randomBytes(32).toString("base64url");
  const [paired] = await db
    .update(posDevices)
    .set({ deviceTokenHash: sha256(deviceToken), pairingCodeHash: null, pairingExpiresAt: null })
    .where(and(
      eq(posDevices.pairingCodeHash, sha256(code)),
      gt(posDevices.pairingExpiresAt, new Date()),
    ))
    .returning({ id: posDevices.id, shopId: posDevices.shopId, name: posDevices.name });
  if (!paired) return null;

  const [shop] = await db.select({
    id: shops.id,
    name: shops.name,
    promptpayId: shops.promptpayId,
    stampGoal: shops.stampGoal,
    receiptFooter: shops.receiptFooter,
  }).from(shops).where(eq(shops.id, paired.shopId)).limit(1);
  if (!shop) return null;

  const cookieStore = await cookies();
  cookieStore.set(DEVICE_COOKIE, deviceToken, cookieOptions(DEVICE_AGE));
  return { deviceId: paired.id, deviceName: paired.name, shop };
}

export async function getPosDevice(): Promise<PosDevice | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      deviceId: posDevices.id,
      deviceName: posDevices.name,
      shopId: shops.id,
      shopName: shops.name,
      promptpayId: shops.promptpayId,
      stampGoal: shops.stampGoal,
      receiptFooter: shops.receiptFooter,
    })
    .from(posDevices)
    .innerJoin(shops, eq(posDevices.shopId, shops.id))
    .where(and(eq(posDevices.deviceTokenHash, sha256(token)), isNotNull(posDevices.deviceTokenHash)))
    .limit(1);
  if (!row) return null;
  await db.update(posDevices).set({ lastSeenAt: new Date() })
    .where(and(eq(posDevices.shopId, row.shopId), eq(posDevices.id, row.deviceId)));
  return {
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    shop: {
      id: row.shopId,
      name: row.shopName,
      promptpayId: row.promptpayId,
      stampGoal: row.stampGoal,
      receiptFooter: row.receiptFooter,
    },
  };
}

export async function requirePosDevice(): Promise<PosDevice> {
  const device = await getPosDevice();
  if (!device) redirect("/pos/pair");
  return device;
}

export async function listPosStaff(shopId: string): Promise<{ id: string; name: string; role: string; hasPin: boolean }[]> {
  const rows = await db.select({
    id: staff.id,
    name: staff.name,
    role: staff.role,
    hasPin: staff.pinHash,
  }).from(staff).where(and(eq(staff.shopId, shopId), eq(staff.isActive, true)));
  return rows.map((row) => ({ ...row, hasPin: row.hasPin !== null }));
}

export async function staffLogin(staffId: string, pin: string): Promise<boolean> {
  const device = await getPosDevice();
  if (!device) return false;
  const [record] = await db.select({ id: staff.id, pinHash: staff.pinHash })
    .from(staff).where(and(eq(staff.shopId, device.shop.id), eq(staff.id, staffId), eq(staff.isActive, true))).limit(1);
  const valid = Boolean(record?.pinHash && await verifyPin(pin, record.pinHash));
  if (!valid) return false;
  const value = JSON.stringify({ staffId: record!.id, deviceId: device.deviceId, exp: Math.floor(Date.now() / 1000) + STAFF_AGE });
  (await cookies()).set(STAFF_COOKIE, sign(value, "pos-staff"), cookieOptions(STAFF_AGE));
  return true;
}

export async function requirePosStaff(): Promise<PosSession> {
  const device = await getPosDevice();
  const cookieStore = await cookies();
  const signed = cookieStore.get(STAFF_COOKIE)?.value;
  const decoded = signed ? unsign(signed, "pos-staff") : null;
  type StaffCookie = { staffId: string; deviceId: string; exp: number };
  let session: StaffCookie | null = null;
  try {
    session = decoded ? JSON.parse(decoded) as StaffCookie : null;
  } catch {
    session = null;
  }
  if (!device || !session || session.deviceId !== device.deviceId || session.exp <= Date.now() / 1000) {
    redirect("/pos/login");
  }
  const [record] = await db.select({ id: staff.id, name: staff.name, role: staff.role })
    .from(staff)
    .where(and(eq(staff.shopId, device.shop.id), eq(staff.id, session.staffId), eq(staff.isActive, true)))
    .limit(1);
  if (!record) redirect("/pos/login");
  return { ...device, shopId: device.shop.id, staff: record };
}

export async function posLogout(): Promise<void> {
  (await cookies()).delete(STAFF_COOKIE);
}

export async function verifyManagerPin(shopId: string, pin: string): Promise<{ staffId: string } | null> {
  const rows = await db.select({ id: staff.id, role: staff.role, pinHash: staff.pinHash }).from(staff)
    .where(and(eq(staff.shopId, shopId), eq(staff.isActive, true), isNotNull(staff.pinHash)));
  let match: string | null = null;
  for (const row of rows) {
    const valid = await verifyPin(pin, row.pinHash!);
    if (valid && (row.role === "owner" || row.role === "manager") && match === null) match = row.id;
  }
  return match ? { staffId: match } : null;
}
