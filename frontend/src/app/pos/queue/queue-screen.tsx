"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { PreparationRow } from "@/server/preparation";
import { advancePreparationAction, loadQueueAction } from "./actions";

interface QueueScreenProps { initial: PreparationRow[]; initialError?: string }
const labels = { received: "รับออเดอร์แล้ว", preparing: "กำลังทำ", ready: "พร้อมรับแล้ว" };

export function QueueScreen({ initial, initialError }: QueueScreenProps) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);

  async function reload() {
    const result = await loadQueueAction();
    if (result.ok) { setRows(result.rows); }
    else { setError(result.message); }
  }

  async function run(order?: PreparationRow) {
    if (active.current) { return; }
    active.current = true;
    setBusy(true);
    setError("");
    try {
      if (!order) { await reload(); }
      else if (order.status !== "ready") {
        const result = await advancePreparationAction(order.id, order.status, order.status === "received" ? "preparing" : "ready");
        if (result.ok) { setRows((current) => current.map((row) => row.id === result.update.id ? { ...row, ...result.update } : row)); }
        else { setError(result.message); await reload(); }
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณารีเฟรชคิวแล้วลองใหม่");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return <main className="min-h-dvh bg-[#F5EDE3] p-4 text-[#3B2A20] md:p-8" aria-busy={busy}>
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><Link href="/pos" className="underline">กลับหน้าขาย</Link><h1 className="mt-2 text-3xl font-bold">คิวเครื่องดื่มวันนี้</h1></div>
      <button type="button" disabled={busy} onClick={() => void run()} className="min-h-12 rounded-xl bg-[#3B2A20] px-6 font-semibold text-white disabled:opacity-50">{busy ? "กำลังตรวจสอบ…" : "รีเฟรชคิว"}</button>
    </header>
    <p className="mb-4 text-sm">กดรีเฟรชคิวเพื่อดูออเดอร์ใหม่และการเปลี่ยนสถานะจากเครื่องอื่น</p>
    {error ? <p role="alert" className="mb-4 rounded-xl bg-red-100 p-4 text-red-900">{error}</p> : null}
    {rows.length === 0 ? <p className="rounded-xl bg-white p-8 text-center">{error ? "ยังโหลดคิวไม่ได้" : "ไม่มีคิววันนี้"}</p> : null}
    <section aria-label="รายการคิว" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((order) => <article key={order.id} className="rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] p-5">
        <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-3xl font-bold">#{String(order.dailyNo).padStart(3, "0")}</h2><span className="rounded-full bg-[#E7F1E8] px-3 py-2 font-semibold">{labels[order.status]}</span></div>
        <ul className="mb-5 space-y-4">{order.items.map((item) => <li key={item.id}><p className="text-lg font-semibold">{item.qty} × {item.name}</p>{item.modifiers.length > 0 ? <p>{item.modifiers.join(", ")}</p> : null}{item.note ? <p className="mt-1 rounded-lg bg-amber-100 p-2 font-semibold">{item.note}</p> : null}</li>)}</ul>
        {order.status !== "ready" ? <button type="button" disabled={busy} onClick={() => void run(order)} className="min-h-14 w-full rounded-xl bg-[#2F6B3F] text-lg font-bold text-white disabled:opacity-50">{order.status === "received" ? "เริ่มทำ" : "พร้อมเสิร์ฟ"}</button> : null}
      </article>)}
    </section>
  </main>;
}
