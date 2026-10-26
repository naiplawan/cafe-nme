"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatBaht } from "@/lib/money";
import type { SelfOrderView } from "@/server/self-orders";
import { decideRequestAction, loadRequestsAction } from "./actions";
export function RequestsScreen({ initial, initialError }: { initial: SelfOrderView[]; initialError?: string }) {
  const [orders, setOrders] = useState(initial);
  const [error, setError] = useState(initialError ?? "");
  const [refreshError, setRefreshError] = useState("");
  const message = error || refreshError;
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const polling = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const run = useCallback(async (id?: string, decision?: "accepted" | "rejected", background = false) => {
    if (active.current || !mounted.current || (background && polling.current)) { return; }
    if (background) { polling.current = true; }
    else { active.current = true; revision.current += 1; setBusy(true); setError(""); setRefreshError(""); }
    const version = revision.current;
    try {
      if (id && decision) {
        const result = await decideRequestAction(id, decision);
        if (!mounted.current || version !== revision.current) { return; }
        if (result.ok) { setRejectId(null); setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order).filter((order) => order.status === "pending" || order.status === "accepted")); }
        else { setError(result.message); }
      } else {
        const result = await loadRequestsAction();
        if (!mounted.current || version !== revision.current) { return; }
        if (result.ok) { setOrders(result.orders); setRefreshError(""); } else { (background ? setRefreshError : setError)(result.message); }
      }
    } catch { if (mounted.current && version === revision.current) { (background ? setRefreshError : setError)("ยังยืนยันผลไม่ได้ กรุณารีเฟรชรายการก่อนลองใหม่"); } }
    finally {
      if (background) { polling.current = false; }
      else { active.current = false; if (mounted.current) { setBusy(false); } }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    function refreshWhenAvailable() {
      if (document.visibilityState !== "hidden" && navigator.onLine) { void run(undefined, undefined, true); }
    }
    const timer = window.setInterval(refreshWhenAvailable, 5000);
    document.addEventListener("visibilitychange", refreshWhenAvailable);
    window.addEventListener("online", refreshWhenAvailable);
    return () => {
      mounted.current = false;
      revision.current += 1;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      window.removeEventListener("online", refreshWhenAvailable);
    };
  }, [run]);
  return <main className="min-h-dvh space-y-5 bg-[#F7F1E7] p-5 text-[#4A2C1A]" aria-busy={busy}>
    <header className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/pos" className="underline">กลับหน้าขาย</Link><h1 className="text-2xl font-bold">รายการจาก QR</h1></div><button type="button" disabled={busy} onClick={() => void run()} className="min-h-12 rounded-xl border bg-white px-5">รีเฟรชรายการ</button></header>
    <p>ตรวจสอบรายการกับลูกค้า รับรายการ แล้วนำไปรับชำระเงินตามปกติ แสดงรายการรอรับ 100 รายการแรก อัปเดตทุก 5 วินาทีเมื่อเปิดหน้านี้และออนไลน์</p>
    {message ? <p role="alert" className="rounded-xl bg-red-100 p-4">{message}</p> : null}
    {orders.length === 0 ? <p>{message ? "ยังโหลดรายการไม่ได้" : "ไม่มีรายการรอรับ"}</p> : null}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{orders.map((order) => <article key={order.id} className="space-y-3 rounded-2xl border bg-[#FFFFFF] p-5">
      <h2 className="text-lg font-bold">{order.mode === "table" ? `โต๊ะ ${order.tableLabel}` : "รับกลับ"}</h2>
      <p>{order.status === "accepted" ? "รับแล้ว · ยังไม่ชำระเงิน" : "รอร้านรับรายการ"}</p>
      <ul className="space-y-2">{order.items.map((item) => <li key={item.id}><p className="font-semibold">{item.qty} × {item.name}</p><p>{item.modifiers.join(", ")}</p>{item.note ? <p className="bg-amber-100 p-2">{item.note}</p> : null}</li>)}</ul>
      <p className="font-bold">{formatBaht(order.totalSatang)}</p>
      {order.status === "pending" ? <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => void run(order.id, "accepted")} className="min-h-12 flex-1 rounded-xl bg-[#2F6B3F] px-3 text-white">รับรายการ</button><button type="button" disabled={busy} onClick={() => setRejectId(order.id)} className="min-h-12 rounded-xl border border-[#E2D8C7] px-3 text-[#8E3415]">ไม่รับรายการ</button></div> : <Link href={`/pos/requests/${order.id}/payment`} className="inline-flex min-h-12 items-center rounded-xl bg-[#2F6B3F] px-4 text-white">เลือกวิธีรับชำระ</Link>}
      {rejectId === order.id && order.status === "pending" ? <fieldset aria-label="ยืนยันไม่รับรายการ" className="space-y-3 rounded-xl bg-[#F7DCD0] p-4 text-[#8E3415]">
        <p>ไม่รับรายการนี้ใช่ไหม? ยกเลิกแล้วนำกลับมาไม่ได้</p>
        <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => setRejectId(null)} className="min-h-12 rounded-xl border border-[#E2D8C7] bg-[#FFFFFF] px-4">กลับ</button><button type="button" disabled={busy} onClick={() => void run(order.id, "rejected")} className="min-h-12 rounded-xl bg-[#8E3415] px-4 font-semibold text-white disabled:opacity-50">ยืนยันไม่รับรายการ</button></div>
      </fieldset> : null}
    </article>)}</div>
  </main>;
}
