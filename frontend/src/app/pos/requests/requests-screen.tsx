"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { SelfOrderView } from "@/server/self-orders";
import { decideRequestAction, loadRequestsAction } from "./actions";
export function RequestsScreen({ initial, initialError }: { initial: SelfOrderView[]; initialError?: string }) {
  const [orders, setOrders] = useState(initial);
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  async function run(id?: string, decision?: "accepted" | "rejected") {
    if (active.current) { return; }
    active.current = true; setBusy(true); setError("");
    try {
      if (id && decision) {
        const result = await decideRequestAction(id, decision);
        if (result.ok) { setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order).filter((order) => order.status === "pending" || order.status === "accepted")); }
        else { setError(result.message); }
      } else {
        const result = await loadRequestsAction();
        if (result.ok) { setOrders(result.orders); } else { setError(result.message); }
      }
    } catch { setError("ยังยืนยันผลไม่ได้ กรุณารีเฟรชรายการก่อนลองใหม่"); }
    finally { active.current = false; setBusy(false); }
  }
  return <main className="min-h-dvh space-y-5 bg-[#F5EDE3] p-5 text-[#3B2A20]" aria-busy={busy}>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/pos" className="underline">กลับหน้าขาย</Link><h1 className="text-2xl font-bold">รายการจาก QR</h1></div><button type="button" disabled={busy} onClick={() => void run()} className="min-h-12 rounded-xl border bg-white px-5">รีเฟรชรายการ</button></header>
    <p>ตรวจสอบรายการกับลูกค้า รับรายการ แล้วนำไปรับชำระเงินตามปกติ แสดงรายการรอรับ 100 รายการแรก</p>
    {error ? <p role="alert" className="rounded-xl bg-red-100 p-4">{error}</p> : null}
    {orders.length === 0 ? <p>{error ? "ยังโหลดรายการไม่ได้" : "ไม่มีรายการรอรับ"}</p> : null}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{orders.map((order) => <article key={order.id} className="space-y-3 rounded-2xl border bg-[#FFFBF6] p-5">
      <h2 className="text-lg font-bold">{order.mode === "table" ? `โต๊ะ ${order.tableLabel}` : "รับกลับ"}</h2>
      <p>{order.status === "accepted" ? "รับแล้ว · ยังไม่ชำระเงิน" : "รอร้านรับรายการ"}</p>
      <ul className="space-y-2">{order.items.map((item) => <li key={item.id}><p className="font-semibold">{item.qty} × {item.name}</p><p>{item.modifiers.join(", ")}</p>{item.note ? <p className="bg-amber-100 p-2">{item.note}</p> : null}</li>)}</ul>
      <p className="font-bold">฿{(order.totalSatang / 100).toLocaleString("th-TH")}</p>
      {order.status === "pending" ? <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => void run(order.id, "accepted")} className="min-h-12 flex-1 rounded-xl bg-[#2F6B3F] px-3 text-white">รับรายการ</button><button type="button" disabled={busy} onClick={() => void run(order.id, "rejected")} className="min-h-12 flex-1 rounded-xl border px-3">ไม่รับรายการ</button></div> : <Link href={`/pos/requests/${order.id}/payment`} className="inline-flex min-h-12 items-center rounded-xl bg-[#2F6B3F] px-4 text-white">เลือกวิธีรับชำระ</Link>}
    </article>)}</div>
  </main>;
}
