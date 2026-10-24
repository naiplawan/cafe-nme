import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getPosMenu } from "@/server/catalog";
import { getSelfOrderShop } from "@/server/self-orders";
import { OrderForm } from "./order-form";
export const instant = false;
export default async function SelfOrderPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  await connection();
  const { shopSlug } = await params;
  const shop = await getSelfOrderShop(shopSlug);
  if (!shop) { notFound(); }
  const menu = await getPosMenu(shop.shopId);
  return <OrderForm menu={menu} shopSlug={shopSlug} shopName={shop.name} />;
}
