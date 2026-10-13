import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { lineChannels, shops } from "@/db/schema";
import { getBrand } from "@/server/brand";
import { getPosMenu } from "@/server/catalog";
import { MemberApp } from "./member-app";

export const instant = false;

export default async function LiffMemberPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  await connection();
  const { shopSlug } = await params;
  const [row] = await db.select({ shopId: shops.id, name: shops.name, stampGoal: shops.stampGoal, liffId: lineChannels.liffId })
    .from(shops).leftJoin(lineChannels, eq(lineChannels.shopId, shops.id))
    .where(eq(shops.slug, shopSlug)).limit(1);
  if (!row) notFound();
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
        })),
      }] : [];
    })(),
  ];
  const devMock = process.env.LINE_DEV_MOCK === "1" && process.env.NODE_ENV !== "production";
  return <MemberApp shopSlug={shopSlug} shopName={row.name} liffId={row.liffId ?? ""} devMock={devMock} menu={menu} brand={{ accent: brand.accent, custom: brand.hasCustomAccent, logoUrl: brand.logoUrl }} />;
}
