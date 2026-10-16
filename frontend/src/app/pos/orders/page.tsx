import { connection } from "next/server";
import { businessDate } from "@/lib/business-date";
import { listOrdersForDay, getOrder } from "@/server/orders";
import { hourlySales, salesByItem, salesSummary } from "@/server/reports";
import { requirePosStaff } from "@/server/pos-session";
import { OrdersScreen } from "./orders-screen";

export const instant = false;

const bangkokHourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" });

export default async function OrdersPage() {
  await connection();
  const session = await requirePosStaff();
  const now = new Date();
  const today = businessDate(now);
  const [orders, summary, hourly, items] = await Promise.all([
    listOrdersForDay(session.shopId, today),
    salesSummary(session.shopId, today, today),
    hourlySales(session.shopId, today, today),
    salesByItem(session.shopId, today, today),
  ]);
  const firstPaidOrder = orders.find((order) => order.status === "paid") ?? orders[0];
  const initialDetail = firstPaidOrder ? await getOrder(session.shopId, firstPaidOrder.id) : null;
  const netSalesSatang = orders.reduce((total, order) => total + (order.status === "paid" ? order.totalSatang : 0), 0);
  const currentHour = Number(bangkokHourFormat.format(now));

  return <OrdersScreen
    orders={orders}
    initialDetail={initialDetail}
    netSalesSatang={netSalesSatang}
    todaySummary={summary}
    hourlySales={hourly}
    topItems={items.slice(0, 5).map(({ name, qty }) => ({ name, qty }))}
    currentHour={currentHour}
  />;
}
