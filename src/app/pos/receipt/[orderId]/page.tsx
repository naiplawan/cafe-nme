import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getOrder } from "@/server/orders";
import { requirePosStaff } from "@/server/pos-session";
import { getBrand } from "@/server/brand";
import { ReceiptView } from "./receipt-view";

export const instant = false;

export default async function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  await connection();
  const session = await requirePosStaff();
  const { orderId } = await params;
  const [order, brand] = await Promise.all([getOrder(session.shopId, orderId), getBrand(session.shopId)]);
  if (!order) notFound();
  return <ReceiptView order={order} logoUrl={brand.logoUrl} />;
}
