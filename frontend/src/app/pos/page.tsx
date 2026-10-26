import { logger } from "@/lib/logger";
import { listShifts } from "@/server/shifts";
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
  const [menu, orders, brand, cashShiftOpen] = await Promise.all([
    getPosMenu(session.shopId),
    listOrdersForDay(session.shopId, date),
    getBrand(session.shopId),
    listShifts(session.shopId, session.staff.id).then((state) => state.shifts.some((shift) => !shift.closedAt)).catch((error) => {
      logger.error({ err: error, shopId: session.shopId }, "POS cash shift lookup failed");
      return null;
    }),
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

  const logoUrl = brand.logoUrl ?? (session.shop.name === "YELO COFFEE" ? "/assets/yelo-coffee-mascot.png" : null);
  return <PosApp cashShiftOpen={cashShiftOpen} acceptedSelfOrder={acceptedSelfOrder} selfOrderError={selfOrderError} shop={session.shop} staff={session.staff} menu={menu} orderNo={nextOrderNo} logoUrl={logoUrl} />;
}
