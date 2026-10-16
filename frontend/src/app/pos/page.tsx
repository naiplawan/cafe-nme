import { connection } from "next/server";
import { businessDate } from "@/lib/business-date";
import { getPosMenu } from "@/server/catalog";
import { listOrdersForDay } from "@/server/orders";
import { requirePosStaff } from "@/server/pos-session";
import { getBrand } from "@/server/brand";
import { PosApp } from "@/app/pos/_components/pos-app";

export const instant = false;

export default async function PosPage() {
  await connection();
  const session = await requirePosStaff();
  const date = businessDate(new Date());
  const [menu, orders, brand] = await Promise.all([
    getPosMenu(session.shopId),
    listOrdersForDay(session.shopId, date),
    getBrand(session.shopId),
  ]);
  const nextOrderNo = Math.max(0, ...orders.map((order) => order.dailyNo)) + 1;

  return <PosApp shop={session.shop} staff={session.staff} menu={menu} orderNo={nextOrderNo} logoUrl={brand.logoUrl} />;
}
