import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";
import { sign, unsign } from "@/lib/signing";

const DEVICE_COOKIE = "pos_device";
const STAFF_COOKIE = "pos_staff";
const DEVICE_AGE = 365 * 24 * 60 * 60;
const STAFF_AGE = 12 * 60 * 60;
const TRAILING_SLASH = /\/$/;
const UUID = z.uuid();

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
export type StaffAdminRow = { id: string; name: string; role: "owner" | "manager" | "barista"; hasPin: boolean; isActive: boolean };
export type DeviceAdminRow = { id: string; name: string; paired: boolean; lastSeenAt: Date | null };

const shopSchema = z.object({
  id: UUID, name: z.string(), promptpayId: z.string().nullable(), stampGoal: z.number().int(), receiptFooter: z.string().nullable(),
}).strict();
const deviceSchema = z.object({ deviceId: UUID, deviceName: z.string(), shop: shopSchema }).strict();
const staffSchema = z.object({ id: UUID, name: z.string(), role: z.enum(["owner", "manager", "barista"]) }).strict();
const idSchema = z.object({ id: UUID }).strict();
const okSchema = z.object({ ok: z.literal(true) }).strict();
const staffAdminSchema = z.object({
  id: UUID, name: z.string(), role: z.enum(["owner", "manager", "barista"]), hasPin: z.boolean(), isActive: z.boolean(),
}).strict();
const deviceAdminSchema = z.object({ id: UUID, name: z.string(), paired: z.boolean(), lastSeenAt: z.coerce.date().nullable() }).strict();

function apiBaseUrl() {
  const base = process.env.API_BASE_URL ?? (process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101");
  if (!base) throw new Error("API_BASE_URL is required to access POS sessions");
  return base.replace(TRAILING_SLASH, "");
}

async function requestApi<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "x-internal-api-token": createInternalApiToken(),
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nest POS access API returned ${response.status}`);
  // Nest sends a handler's `null` (e.g. a wrong PIN) as an empty body, which response.json() cannot parse.
  const text = await response.text();
  const parsed = schema.safeParse(text ? JSON.parse(text) : null);
  if (!parsed.success) throw new Error("Nest POS access API returned an invalid payload");
  return parsed.data;
}

const shopPath = (shopId: string) => `/v1/shops/${encodeURIComponent(UUID.parse(shopId))}`;
const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function createDevice(shopId: string, actorStaffIdOrName: string, name?: string) {
  if (name === undefined) throw new Error("An authenticated staff ID is required to create a POS device");
  return requestApi(`${shopPath(shopId)}/pos-devices`, z.object({ deviceId: UUID, pairingCode: z.string().regex(/^\d{8}$/) }).strict(), {
    method: "POST", body: JSON.stringify({ actorStaffId: actorStaffIdOrName, name }),
  });
}

export async function regeneratePairingCode(shopId: string, actorStaffIdOrDeviceId: string, deviceId?: string) {
  if (deviceId === undefined) throw new Error("An authenticated staff ID is required to regenerate a pairing code");
  const value = await requestApi(`${shopPath(shopId)}/pos-devices/${encodeURIComponent(UUID.parse(deviceId))}/pairing-code`, z.object({ pairingCode: z.string().regex(/^\d{8}$/) }).strict(), {
    method: "POST", body: JSON.stringify({ actorStaffId: actorStaffIdOrDeviceId }),
  });
  return value.pairingCode;
}

export async function listAdminDevices(shopId: string, actorStaffId: string): Promise<DeviceAdminRow[]> {
  return requestApi(`${shopPath(shopId)}/pos-devices?actorStaffId=${encodeURIComponent(UUID.parse(actorStaffId))}`, z.array(deviceAdminSchema));
}

export async function removeAdminDevice(shopId: string, actorStaffId: string, deviceId: string) {
  await requestApi(`${shopPath(shopId)}/pos-devices/${encodeURIComponent(UUID.parse(deviceId))}?actorStaffId=${encodeURIComponent(UUID.parse(actorStaffId))}`, okSchema, { method: "DELETE" });
}

export async function listAdminStaff(shopId: string, actorStaffId: string): Promise<StaffAdminRow[]> {
  return requestApi(`${shopPath(shopId)}/staff?actorStaffId=${encodeURIComponent(UUID.parse(actorStaffId))}`, z.array(staffAdminSchema));
}

export async function createAdminStaff(shopId: string, actorStaffId: string, input: { name: string; role: string; pin: string }) {
  return requestApi(`${shopPath(shopId)}/staff`, idSchema, { method: "POST", body: JSON.stringify({ actorStaffId, ...input }) });
}

export async function setAdminStaffPin(shopId: string, actorStaffId: string, staffId: string, pin: string) {
  return requestApi(`${shopPath(shopId)}/staff/${encodeURIComponent(UUID.parse(staffId))}/pin`, idSchema, { method: "POST", body: JSON.stringify({ actorStaffId, pin }) });
}

export async function setAdminStaffActive(shopId: string, actorStaffId: string, staffId: string, active: boolean) {
  return requestApi(`${shopPath(shopId)}/staff/${encodeURIComponent(UUID.parse(staffId))}/active`, idSchema, { method: "POST", body: JSON.stringify({ actorStaffId, active }) });
}

export async function pairDevice(code: string): Promise<PosDevice | null> {
  if (!/^\d{8}$/.test(code)) return null;
  const response = await fetch(`${apiBaseUrl()}/v1/pos/pair`, {
    method: "POST",
    headers: { "x-internal-api-token": createInternalApiToken(), "content-type": "application/json" },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Nest POS access API returned ${response.status}`);
  const pairedSchema = deviceSchema.extend({ deviceToken: z.string().min(32) }).strict().nullable();
  const parsed = pairedSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Nest POS access API returned an invalid pairing payload");
  if (!parsed.data) return null;
  const { deviceToken, ...device } = parsed.data;
  (await cookies()).set(DEVICE_COOKIE, deviceToken, cookieOptions(DEVICE_AGE));
  return device;
}

async function readDeviceToken() {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
}

export async function getPosDevice(): Promise<PosDevice | null> {
  const token = await readDeviceToken();
  if (!token) return null;
  return requestApi("/v1/pos/device", deviceSchema.nullable(), { method: "POST", body: JSON.stringify({ deviceToken: token }) });
}

export async function requirePosDevice(): Promise<PosDevice> {
  const device = await getPosDevice();
  if (!device) redirect("/pos/pair");
  return device;
}

export async function listPosStaff(shopId: string) {
  const token = await readDeviceToken();
  if (!token) return [];
  return requestApi(`${shopPath(shopId)}/pos-staff/list`, z.array(z.object({
    id: UUID, name: z.string(), role: z.enum(["owner", "manager", "barista"]), hasPin: z.boolean(),
  }).strict()), { method: "POST", body: JSON.stringify({ deviceToken: token }) });
}

export async function staffLogin(staffId: string, pin: string): Promise<boolean> {
  if (!UUID.safeParse(staffId).success) return false;
  const device = await getPosDevice();
  const token = await readDeviceToken();
  if (!device || !token) return false;
  const value = await requestApi(`${shopPath(device.shop.id)}/pos-staff/login`, z.object({ staffId: UUID, deviceId: UUID, shopId: UUID }).strict().nullable(), {
    method: "POST", body: JSON.stringify({ deviceToken: token, staffId, pin }),
  });
  if (!value || value.deviceId !== device.deviceId || value.shopId !== device.shop.id || value.staffId !== staffId) return false;
  const session = JSON.stringify({ staffId: value.staffId, deviceId: value.deviceId, exp: Math.floor(Date.now() / 1000) + STAFF_AGE });
  (await cookies()).set(STAFF_COOKIE, sign(session, "pos-staff"), cookieOptions(STAFF_AGE));
  return true;
}

export async function requirePosStaff(): Promise<PosSession> {
  const device = await getPosDevice();
  const cookieStore = await cookies();
  const signed = cookieStore.get(STAFF_COOKIE)?.value;
  const decoded = signed ? unsign(signed, "pos-staff") : null;
  type StaffCookie = { staffId: string; deviceId: string; exp: number };
  let session: StaffCookie | null = null;
  try { session = decoded ? JSON.parse(decoded) as StaffCookie : null; } catch { session = null; }
  if (!device || !session || session.deviceId !== device.deviceId || session.exp <= Date.now() / 1000) redirect("/pos/login");
  const staffId = UUID.safeParse(session.staffId);
  if (!staffId.success) redirect("/pos/login");
  const staff = await requestApi(`${shopPath(device.shop.id)}/pos-staff/${encodeURIComponent(staffId.data)}`, staffSchema.nullable());
  if (!staff) redirect("/pos/login");
  return { ...device, shopId: device.shop.id, staff };
}

export async function posLogout(): Promise<void> {
  (await cookies()).delete(STAFF_COOKIE);
}

export async function verifyManagerPin(shopId: string, pin: string): Promise<{ staffId: string } | null> {
  const actor = await requirePosStaff();
  if (actor.shopId !== shopId) return null;
  const value = await requestApi(`${shopPath(shopId)}/pos-staff/manager-pin`, z.object({ staffId: UUID }).strict().nullable(), {
    method: "POST", body: JSON.stringify({ actorStaffId: actor.staff.id, pin }),
  });
  return value;
}
