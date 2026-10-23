import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getShopProfile } from "./admin-data";
import { getMemberSummary } from "./loyalty";
import { getOrder, listOrdersForDay } from "./orders";
import { getPosPromptPayConfig, getPosReceiptRecipient, togglePosProductSoldOut } from "./pos-operations";
import { pairDevice } from "./pos-session";
import { findStaffSession, findStaffShops } from "./staff-session";

const shopId = "11111111-1111-4111-8111-111111111111";
const missingId = "22222222-2222-4222-8222-222222222222";
const lookups = [
  { name: "member summary", read: () => getMemberSummary(shopId, missingId) },
  { name: "order", read: () => getOrder(shopId, missingId) },
  { name: "staff membership", read: () => findStaffSession(missingId, shopId) },
  { name: "shop profile", read: () => getShopProfile(shopId) },
  { name: "PromptPay configuration", read: () => getPosPromptPayConfig(shopId) },
  { name: "receipt recipient", read: () => getPosReceiptRecipient(shopId, missingId) },
  { name: "sold-out product", read: () => togglePosProductSoldOut(shopId, missingId) },
  { name: "device pairing", read: () => pairDevice("12345678") },
];

describe("nullable Nest responses", () => {
  beforeEach(() => { vi.stubEnv("INTERNAL_API_SECRET", "test-secret".repeat(4)); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it.each(lookups)("returns null for an empty $name response", async ({ read }) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    await expect(read()).resolves.toBeNull();
  });

  it.each(lookups)("still accepts explicit JSON null for $name", async ({ read }) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(null)));
    await expect(read()).resolves.toBeNull();
  });

  it.each(lookups)("does not hide invalid JSON or HTTP failures for $name", async ({ read }) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{")));
    await expect(read()).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    await expect(read()).rejects.toThrow("500");
  });

  it("rejects empty responses for non-nullable results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null)));
    await expect(listOrdersForDay(shopId, "2026-10-23")).rejects.toThrow();
    await expect(findStaffShops(missingId)).rejects.toThrow();
  });
});
