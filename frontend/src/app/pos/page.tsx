import { getAcceptedSelfOrder } from "@/server/self-orders";
import { z } from "zod";
import { connection } from "next/server";
import { businessDate } from "@/lib/business-date";
import { getPosMenu } from "@/server/catalog";
import { listOrdersForDay } from "@/server/orders";
import { requirePosStaff } from "@/server/pos-session";
import { getBrand } from "@/server/brand";
import { PosApp } from "@/app/pos/_components/pos-app";

export const instant = false;

export default async function PosPage({ searchParams }: { searchParams: Promise<{ selfOrderId?: string }> }) {
  await connection();
  const session = await requirePosStaff();
  const date = businessDate(new Date());
  const [menu, orders, brand] = await Promise.all([
    getPosMenu(session.shopId),
    listOrdersForDay(session.shopId, date),
    getBrand(session.shopId),
  ]);
  const { selfOrderId } = await searchParams;
  let acceptedSelfOrder = null;
  let selfOrderError: string | undefined;
  if (selfOrderId) {
    try {
      const id = z.uuid().parse(selfOrderId);
      acceptedSelfOrder = { id, ...await getAcceptedSelfOrder(session.shopId, session.staff.id, id) };
    } catch { selfOrderError = "รายการจาก QR ไม่พร้อมรับชำระ อาจชำระแล้ว กรุณาตรวจสอบรายการเดิม"; }
  }
  const nextOrderNo = Math.max(0, ...orders.map((order) => order.dailyNo)) + 1;

  return <PosApp acceptedSelfOrder={acceptedSelfOrder} selfOrderError={selfOrderError} shop={session.shop} staff={session.staff} menu={menu} orderNo={nextOrderNo} logoUrl={brand.logoUrl} />;
}
