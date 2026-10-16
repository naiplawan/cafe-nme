import { requireStaff } from "@/lib/auth";
import { ordersForExport } from "@/server/reports";
import { csvCell } from "./csv";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null): value is string {
  return Boolean(value && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
}

function moneyCell(satang: string | number) {
  return (Number(satang) / 100).toFixed(2);
}

export async function GET(request: Request) {
  const { shopId, staff } = await requireStaff();
  if (staff.role !== "owner" && staff.role !== "manager") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!validDate(from) || !validDate(to)) return new Response("Invalid date range", { status: 400 });
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days < 0 || days > 365) return new Response("Invalid date range", { status: 400 });

  const records = await ordersForExport(shopId, from, to);
  const columns: { key: string; label: string; money?: boolean }[] = [
    { key: "date", label: "วันที่" },
    { key: "orderNo", label: "เลขที่ออเดอร์" },
    { key: "member", label: "สมาชิก" },
    { key: "paymentMethod", label: "วิธีชำระเงิน" },
    { key: "grossSatang", label: "ยอดก่อนส่วนลด (บาท)", money: true },
    { key: "discountSatang", label: "ส่วนลด (บาท)", money: true },
    { key: "netSatang", label: "ยอดสุทธิ (บาท)", money: true },
    { key: "cups", label: "จำนวนแก้ว" },
  ];
  const rows = [columns.map((column) => csvCell(column.label)).join(",")];
  for (const record of records) {
    rows.push(columns.map((column) => {
      const value = record[column.key] ?? "";
      return csvCell(column.money ? moneyCell(value) : value);
    }).join(","));
  }

  return new Response(`\uFEFF${rows.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=cafe-orders-${from}-${to}.csv`,
      "Cache-Control": "no-store",
    },
  });
}
