import "server-only";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createInternalApiToken } from "@/lib/internal-api-token";
import { getBrand } from "@/server/brand";
import { getPosMenu } from "@/server/catalog";
import { MemberApp } from "./member-app";

export const instant = false;

const shopSchema = z.object({
  shopId: z.uuid(),
  name: z.string(),
  stampGoal: z.number().int().positive(),
  liffId: z.string().nullable(),
}).nullable();
const TRAILING_SLASH = /\/$/;

async function getLiffShop(shopSlug: string) {
  const apiBaseUrl = process.env.API_BASE_URL ?? (
    process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3101"
  );
  if (!apiBaseUrl) { throw new Error("API_BASE_URL is required to read LIFF shop data"); }
  const response = await fetch(
    `${apiBaseUrl.replace(TRAILING_SLASH, "")}/v1/liff/shops/${encodeURIComponent(shopSlug)}`,
    {
      headers: { "x-internal-api-token": createInternalApiToken() },
      cache: "no-store",
    },
  );
  if (!response.ok) { throw new Error(`Nest LIFF API returned ${response.status}`); }
  const parsed = shopSchema.safeParse(await response.json());
  if (!parsed.success) { throw new Error("Nest LIFF API returned an invalid shop payload"); }
  return parsed.data;
}

export default async function LiffMemberPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  await connection();
  const { shopSlug } = await params;
  const row = await getLiffShop(shopSlug);
  if (!row) { notFound(); }
  const [brand, posMenu] = await Promise.all([getBrand(row.shopId), getPosMenu(row.shopId)]);
  const menu = [
    ...posMenu.categories.map((category) => ({
      id: category.id,
      name: category.name,
      products: posMenu.products.filter((product) => product.categoryId === category.id).map((product) => ({
        id: product.id,
        name: product.name,
        priceSatang: product.basePriceSatang,
        imageUrl: product.imageUrl,
        soldOut: product.soldOut,
      })),
    })).filter((category) => category.products.length > 0),
    ...(() => {
      const uncategorized = posMenu.products.filter((product) => product.categoryId === null);
      return uncategorized.length ? [{
        id: "uncategorized",
        name: "อื่นๆ",
        products: uncategorized.map((product) => ({
          id: product.id,
          name: product.name,
          priceSatang: product.basePriceSatang,
          imageUrl: product.imageUrl,
        soldOut: product.soldOut,
        })),
      }] : [];
    })(),
  ];
  const devMock = process.env.LINE_DEV_MOCK === "1" && process.env.NODE_ENV !== "production";
  return <MemberApp shopSlug={shopSlug} shopName={row.name} liffId={row.liffId ?? ""} devMock={devMock} menu={menu} brand={{ accent: brand.accent, custom: brand.hasCustomAccent, logoUrl: brand.logoUrl }} />;
}
