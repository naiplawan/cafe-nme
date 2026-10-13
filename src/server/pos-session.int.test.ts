import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posDevices, shops, staff } from "@/db/schema";
import { hashPin } from "@/lib/pin";
import { createDevice, getPosDevice, listPosStaff, pairDevice, regeneratePairingCode, verifyManagerPin } from "./pos-session";

const cookies = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    api: {
      get: (name: string) => values.has(name) ? { name, value: values.get(name)! } : undefined,
      set: (name: string, value: string) => values.set(name, value),
      delete: (name: string) => values.delete(name),
    },
  };
});
vi.mock("next/headers", () => ({ cookies: async () => cookies.api }));

describe("POS session integration", () => {
  const slug = `pos-auth-test-${randomUUID()}`;
  let shopId: string;
  let deviceId: string;
  let managerId: string;
  let inactiveId: string;

  beforeAll(async () => {
    const [shop] = await db.insert(shops).values({ name: "POS Auth Test", slug }).returning();
    shopId = shop.id;
    const [manager] = await db.insert(staff).values({ shopId, name: "Manager", role: "manager", pinHash: await hashPin("2468") }).returning();
    managerId = manager.id;
    const [inactive] = await db.insert(staff).values({ shopId, name: "Inactive", role: "owner", pinHash: await hashPin("1357"), isActive: false }).returning();
    inactiveId = inactive.id;
  });

  afterAll(async () => {
    cookies.values.clear();
    if (shopId) await db.delete(shops).where(eq(shops.id, shopId));
  });

  it("creates and regenerates shop-scoped one-time pairing codes", async () => {
    const created = await createDevice(shopId, "Tablet");
    deviceId = created.deviceId;
    expect(created.pairingCode).toMatch(/^\d{6}$/);
    const [stored] = await db.select().from(posDevices).where(and(eq(posDevices.shopId, shopId), eq(posDevices.id, deviceId)));
    expect(stored.pairingCodeHash).not.toBe(created.pairingCode);
    expect(stored.pairingExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    const renewed = await regeneratePairingCode(shopId, deviceId);
    expect(renewed).toMatch(/^\d{6}$/);
    expect(renewed).not.toBe(created.pairingCode);
    await expect(regeneratePairingCode(randomUUID(), deviceId)).rejects.toThrow("POS device not found");
  });

  it("consumes a valid pairing code, sets the device cookie, and returns its shop", async () => {
    const [device] = await db.select().from(posDevices).where(and(eq(posDevices.shopId, shopId), eq(posDevices.id, deviceId)));
    const [paired] = await db.select().from(posDevices).where(eq(posDevices.id, deviceId));
    expect(paired.pairingCodeHash).toBe(device.pairingCodeHash);
    const code = await regeneratePairingCode(shopId, deviceId);
    const result = await pairDevice(code);
    expect(result).toMatchObject({ deviceId, deviceName: "Tablet", shop: { id: shopId, name: "POS Auth Test" } });
    expect(cookies.values.get("pos_device")).toBeTruthy();
    const refreshed = await getPosDevice();
    expect(refreshed?.deviceId).toBe(deviceId);
    const [consumed] = await db.select().from(posDevices).where(eq(posDevices.id, deviceId));
    expect(consumed.pairingCodeHash).toBeNull();
    expect(await pairDevice(code)).toBeNull();
  });

  it("only lists active shop staff and verifies an active manager PIN", async () => {
    const rows = await listPosStaff(shopId);
    expect(rows.map((row) => row.id)).toContain(managerId);
    expect(rows.map((row) => row.id)).not.toContain(inactiveId);
    expect(await verifyManagerPin(shopId, "2468")).toEqual({ staffId: managerId });
    expect(await verifyManagerPin(shopId, "1357")).toBeNull();
    expect(await verifyManagerPin(randomUUID(), "2468")).toBeNull();
  });
});
