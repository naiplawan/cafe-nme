"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreparationRow } from "@/server/preparation";
import { advancePreparationAction, loadQueueAction, remakeDrinkAction } from "./actions";

interface QueueScreenProps { initial: PreparationRow[]; initialError?: string }
const labels = { received: "รับออเดอร์แล้ว", preparing: "กำลังทำ", ready: "พร้อมรับแล้ว" };
const statusStyles = { received: "bg-[#F7F1E7] text-[#817668]", preparing: "bg-[#F7DCD0] text-[#8E3415]", ready: "bg-[#E7F1E8] text-[#245232]" };
const REFRESH_INTERVAL_MS = 5000;

export function QueueScreen({ initial, initialError }: QueueScreenProps) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const mounted = useRef(false);
  const polling = useRef(false);
  const revision = useRef(0);

  const run = useCallback(async (order?: PreparationRow, background = false) => {
    if (active.current || !mounted.current || (background && polling.current)) { return; }
    if (background) { polling.current = true; }
    else { active.current = true; revision.current += 1; setBusy(true); setError(""); }
    const version = revision.current;
    async function reload() {
      const result = await loadQueueAction();
      if (!mounted.current || version !== revision.current) { return; }
      if (result.ok) { setRows(result.rows); setError(""); }
      else { setError(result.message); }
    }
    try {
      if (!order) { await reload(); }
      else if (order.status !== "ready") {
        const result = await advancePreparationAction(order.id, order.status, order.status === "received" ? "preparing" : "ready");
        if (!mounted.current) { return; }
        if (result.ok) { setRows((current) => current.map((row) => row.id === result.update.id ? { ...row, ...result.update } : row)); }
        else { setError(result.message); await reload(); }
      }
    } catch {
      if (mounted.current && version === revision.current) { setError("เชื่อมต่อไม่สำเร็จ กรุณารีเฟรชคิวแล้วลองใหม่"); }
    } finally {
      if (background) { polling.current = false; }
      else { active.current = false; if (mounted.current) { setBusy(false); } }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    function refreshWhenAvailable() {
      if (document.visibilityState === "hidden" || !navigator.onLine) { return; }
      void run(undefined, true);
    }
    const timer = window.setInterval(refreshWhenAvailable, REFRESH_INTERVAL_MS);
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

  return <main className="min-h-dvh bg-[#F7F1E7] p-4 text-[#4A2C1A] md:p-8" aria-busy={busy}>
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><Link href="/pos" className="underline">กลับหน้าขาย</Link><h1 className="mt-2 text-3xl font-bold">คิวเครื่องดื่มวันนี้</h1></div>
      <button type="button" disabled={busy} onClick={() => void run()} className="min-h-12 rounded-xl bg-[#4A2C1A] px-6 font-semibold text-white disabled:opacity-50">{busy ? "กำลังตรวจสอบ…" : "รีเฟรชคิว"}</button>
    </header>
    <p className="mb-4 text-sm">คิวอัปเดตอัตโนมัติทุก 5 วินาทีเมื่อเปิดหน้านี้และเชื่อมต่ออินเทอร์เน็ต</p>
    {error ? <p role="alert" className="mb-4 rounded-xl bg-red-100 p-4 text-red-900">{error}</p> : null}
    {rows.length === 0 ? <p className="rounded-xl bg-white p-8 text-center">{error ? "ยังโหลดคิวไม่ได้" : "ไม่มีคิววันนี้"}</p> : null}
    <section aria-label="รายการคิว" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((order) => <article key={order.id} className="rounded-2xl border border-[#E2D8C7] bg-[#FFFFFF] p-5">
        <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-3xl font-bold">#{String(order.dailyNo).padStart(3, "0")}</h2><span className={`rounded-full px-3 py-2 font-semibold ${statusStyles[order.status]}`}>{labels[order.status]}</span></div>
        <ul className="mb-5 space-y-4">{order.items.map((item) => <li key={item.id}><p className="text-lg font-semibold">{item.qty} × {item.name}</p>{item.modifiers.length > 0 ? <p>{item.modifiers.join(", ")}</p> : null}{item.note ? <p className="mt-1 rounded-lg bg-amber-100 p-2 font-semibold">{item.note}</p> : null}{order.status !== "received" ? <RemakeForm orderId={order.id} itemId={item.id} maxQty={item.qty} /> : null}</li>)}</ul>
        {order.status !== "ready" ? <button type="button" disabled={busy} onClick={() => void run(order)} className="min-h-14 w-full rounded-xl bg-[#2F6B3F] text-lg font-bold text-white disabled:opacity-50">{order.status === "received" ? "เริ่มทำ" : "พร้อมเสิร์ฟ"}</button> : null}
      </article>)}
    </section>
  </main>;
}

function RemakeForm({ orderId, itemId, maxQty }: { orderId: string; itemId: string; maxQty: number }) {
  const request = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  return <details className="mt-2"><summary className="cursor-pointer py-2 underline">ทำใหม่ (ไม่คิดเงินเพิ่ม)</summary>
    <form className="grid gap-2" onSubmit={async event => {
      event.preventDefault();
      if (busy || done) return;
      request.current ??= crypto.randomUUID();
      const form = new FormData(event.currentTarget);
      setBusy(true);
      try {
        const result = await remakeDrinkAction({ orderId, itemId, requestId: request.current, qty: Number(form.get('qty')), reason: String(form.get('reason') ?? '') });
        setMessage(result.message); setDone(result.ok);
      } catch { setMessage('ยังยืนยันผลไม่ได้ กรุณาลองรายการเดิมอีกครั้ง'); }
      finally { setBusy(false); }
    }}>
      <label>จำนวน<input className="min-h-11 w-full rounded border px-2" name="qty" type="number" min="1" max={maxQty} defaultValue="1" required disabled={busy || done} /></label>
      <label>เหตุผล<input className="min-h-11 w-full rounded border px-2" name="reason" maxLength={500} required disabled={busy || done} /></label>
      <button type="submit" className="min-h-11 rounded border px-3" disabled={busy || done}>บันทึกทำใหม่</button>
      {done ? <button type="button" className="min-h-11 underline" onClick={() => { request.current = null; setDone(false); setMessage(''); }}>ทำใหม่อีกครั้ง</button> : null}
      {message ? <p role="status">{message}</p> : null}
    </form>
  </details>;
}
