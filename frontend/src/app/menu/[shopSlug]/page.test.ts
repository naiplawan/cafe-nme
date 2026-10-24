import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/auth", () => ({ requireStaff: () => { throw new Error("Public menu must not require staff"); } }));
vi.mock("@line/liff", () => ({ default: { init: () => { throw new Error("Public menu must not initialize LINE"); } } }));
import PublicMenuPage from "./page";

const shopId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const product: { id: string; name: string; categoryId: string | null; basePriceSatang: number; imageUrl: null; tileColor: null; earnsStamp: boolean; soldOut: boolean; groups: [] } = { id: productId, name: "Iced latte", categoryId, basePriceSatang: 6550, imageUrl: null, tileColor: null, earnsStamp: true, soldOut: false, groups: [] };

function respond(menuProducts = [product], missing = false) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (init?.cache !== "no-store") { throw new Error("Public menu must fetch fresh availability"); }
    if (url.endsWith("/v1/liff/shops/test-cafe")) {
      return missing ? new Response(null) : Response.json({ shopId, name: "Public Cafe", stampGoal: 10, liffId: null });
    }
    if (url.endsWith(`/v1/shops/${shopId}/pos-menu`)) {
      return Response.json({ categories: [{ id: categoryId, name: "Coffee" }], products: menuProducts });
    }
    if (url.endsWith(`/v1/shops/${shopId}/brand`)) {
      return Response.json({ accent: "#123456", hasCustomAccent: true, logoUpdatedAt: null });
    }
    throw new Error(`Unexpected public menu request: ${url}`);
  }));
}

beforeEach(() => { vi.stubEnv("INTERNAL_API_SECRET", "test-secret".repeat(4)); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("renders prices anonymously without LINE configuration and offers membership only as a link", async () => {
  respond();
  const html = renderToStaticMarkup(await PublicMenuPage({ params: Promise.resolve({ shopSlug: "test-cafe" }) }));
  expect(html).toContain("Public Cafe");
  expect(html).toContain("Iced latte");
  expect(html).toContain("65.5");
  expect(html).toContain('href="/liff/test-cafe"');
  expect(html).not.toContain("11111111-1111-4111-8111-111111111111");
  expect(html).not.toContain("stampGoal");
});
it("renders sold-out state and products without a category", async () => {
  respond([{ ...product, categoryId: null, soldOut: true }]);
  const html = renderToStaticMarkup(await PublicMenuPage({ params: Promise.resolve({ shopSlug: "test-cafe" }) }));
  expect(html).toContain("Iced latte");
  expect(html).toContain("หมดชั่วคราว");
  expect(html).toContain("อื่นๆ");
});
it("renders an empty menu without empty category sections", async () => {
  respond([]);
  const html = renderToStaticMarkup(await PublicMenuPage({ params: Promise.resolve({ shopSlug: "test-cafe" }) }));
  expect(html).toContain("ยังไม่มีเมนู");
  expect(html).not.toContain("Coffee");
});
it("returns not found for an unknown shop", async () => {
  respond([], true);
  await expect(PublicMenuPage({ params: Promise.resolve({ shopSlug: "test-cafe" }) })).rejects.toThrow("NEXT_NOT_FOUND");
});
it("returns not found for malformed slugs before accessing the backend", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("Invalid slug must not reach backend"); });
  await expect(PublicMenuPage({ params: Promise.resolve({ shopSlug: "../private" }) })).rejects.toThrow("NEXT_NOT_FOUND");
});
