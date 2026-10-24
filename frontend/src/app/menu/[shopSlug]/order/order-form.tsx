"use client";
import { useEffect, useRef, useState } from "react";
import type { CartLineInput, PosMenu, PosProduct } from "@/lib/pricing";
import type { SelfOrderInput, SelfOrderView } from "@/server/self-orders";
import { selfOrderInputSchema } from "./schema";
import { selfOrderStatusAction, submitSelfOrderAction } from "./actions";

const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH")}`;
const statusLabels = { pending: "รอร้านรับรายการ · ยังไม่ชำระเงิน", accepted: "ร้านรับรายการแล้ว · กรุณาชำระเงินที่เคาน์เตอร์", rejected: "ร้านไม่รับรายการนี้", completed: "ชำระเงินแล้ว" };

function ProductChoice({ product, add }: { product: PosProduct; add: (line: CartLineInput) => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [modifiers, setModifiers] = useState<string[]>([]);
  return <article className="space-y-3 rounded-2xl border bg-white p-4">
    <h2 className="text-lg font-semibold">{product.name} · {money(product.basePriceSatang)}</h2>
    {product.groups.map((group) => <fieldset key={group.id} className="space-y-1"><legend>{group.name} (เลือก {group.minSelect}–{group.maxSelect})</legend>
      {group.modifiers.map((modifier) => <label key={modifier.id} className="flex items-center gap-2"><input type="checkbox" checked={modifiers.includes(modifier.id)} onChange={(event) => setModifiers((current) => event.target.checked ? [...current, modifier.id] : current.filter((id) => id !== modifier.id))} />{modifier.name} ({money(modifier.priceDeltaSatang)})</label>)}
    </fieldset>)}
    <div className="flex gap-3"><label>จำนวน<input aria-label={`จำนวน ${product.name}`} type="number" min={1} max={99} value={qty} onChange={(event) => setQty(Number(event.target.value))} className="ml-2 w-20 rounded border p-2" /></label></div>
    <label className="block">หมายเหตุ<input aria-label={`หมายเหตุ ${product.name}`} maxLength={120} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
    <button type="button" disabled={product.soldOut || !Number.isInteger(qty) || qty < 1 || qty > 99 || product.groups.some((group) => { const count = group.modifiers.filter((modifier) => modifiers.includes(modifier.id)).length; return count < group.minSelect || count > group.maxSelect; })}
      onClick={() => add({ productId: product.id, qty, modifierIds: modifiers, note })} className="min-h-12 w-full rounded-xl bg-[#2F6B3F] font-semibold text-white disabled:opacity-40">{product.soldOut ? "หมดชั่วคราว" : `เพิ่ม ${product.name}`}</button>
  </article>;
}

export function OrderForm({ menu, shopSlug, shopName }: { menu: PosMenu; shopSlug: string; shopName: string }) {
  const storageKey = `cafe-self-order:${shopSlug}`;
  const [lines, setLines] = useState<(CartLineInput & { key: string })[]>([]);
  const [mode, setMode] = useState<"pickup" | "table">("pickup");
  const [tableLabel, setTableLabel] = useState("");
  const [pending, setPending] = useState<SelfOrderInput | null>(null);
  const [order, setOrder] = useState<SelfOrderView | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { setPending(selfOrderInputSchema.parse(JSON.parse(saved))); }
      setReady(true);
    } catch { setError("ไม่สามารถอ่านรายการเดิมได้ กรุณาติดต่อพนักงานก่อนสั่งใหม่"); }
  }, [storageKey]);

  async function send() {
    if (active.current || !ready) { return; }
    active.current = true; setBusy(true); setError("");
    try {
      const request = pending ?? { clientKey: crypto.randomUUID(), statusToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join(""), mode, tableLabel: mode === "table" ? tableLabel.trim() : null, lines: lines.map(({ productId, qty, modifierIds, note }) => ({ productId, qty, modifierIds, note })) };
      localStorage.setItem(storageKey, JSON.stringify(request));
      setPending(request);
      const result = await submitSelfOrderAction(shopSlug, request);
      if (result.ok) { setOrder(result.order); }
      else {
        setError(result.message);
        if (!result.retryable) { localStorage.removeItem(storageKey); setPending(null); }
      }
    } catch { setError("ยังไม่ทราบผล กรุณาตรวจสอบรายการเดิมอีกครั้งก่อนสั่งใหม่"); }
    finally { active.current = false; setBusy(false); }
  }
  async function refresh() {
    if (!pending || active.current) { return; }
    active.current = true; setBusy(true); setError("");
    try {
      const result = await selfOrderStatusAction(shopSlug, pending.statusToken);
      if (result.ok) { setOrder(result.order); } else { setError(result.message); }
    } catch { setError("ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่"); }
    finally { active.current = false; setBusy(false); }
  }
  function startNew() {
    try { localStorage.removeItem(storageKey); setPending(null); setOrder(null); setLines([]); }
    catch { setError("ไม่สามารถเริ่มรายการใหม่ได้ กรุณาติดต่อพนักงาน"); }
  }
  return <main className="mx-auto max-w-xl space-y-5 bg-[#FFFBF6] p-5 text-[#3B2A20]" aria-busy={busy}>
    <h1 className="text-2xl font-bold">สั่งเครื่องดื่ม · {shopName}</h1><p>ส่งรายการให้ร้านตรวจสอบ แล้วชำระเงินกับพนักงาน</p>
    {error ? <p role="alert" className="rounded-xl bg-red-100 p-3">{error}</p> : null}
    {order ? <section className="space-y-4 rounded-xl border p-4" aria-live="polite"><h2 className="text-xl font-semibold">{statusLabels[order.status]}</h2>
      {order.dailyNo !== null ? <p>คิว #{String(order.dailyNo).padStart(3, "0")}</p> : null}
      <ul>{order.items.map((item) => <li key={item.id}>{item.qty} × {item.name} {item.modifiers.join(", ")}{item.note ? ` · ${item.note}` : ""}</li>)}</ul>
      <p>ยอดรายการ {money(order.totalSatang)}</p><button type="button" disabled={busy} onClick={() => void refresh()} className="min-h-12 rounded-xl border px-4">รีเฟรชสถานะ</button>
      {order.status === "completed" || order.status === "rejected" ? <button type="button" onClick={startNew} disabled={busy} className="ml-3 min-h-12 rounded-xl border px-4">เริ่มรายการใหม่</button> : null}
    </section> : pending ? <section><p>มีรายการที่ยังต้องตรวจสอบ</p><button type="button" onClick={() => void send()} disabled={busy} className="min-h-12 rounded-xl bg-[#2F6B3F] px-5 text-white">ตรวจสอบรายการเดิม</button></section> : <fieldset disabled={!ready || busy} className="space-y-5">
      {menu.products.map((product) => <ProductChoice key={product.id} product={product} add={(line) => setLines((current) => [...current, { ...line, key: crypto.randomUUID() }])} />)}
      <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">รายการที่เลือก</h2><ul>{lines.map((line, index) => <li key={line.key} className="flex justify-between gap-2"><span>{line.qty} × {menu.products.find((product) => product.id === line.productId)?.name}{line.note ? ` · ${line.note}` : ""}</span><button type="button" onClick={() => setLines((current) => current.filter((_, entry) => entry !== index))}>ลบ</button></li>)}</ul>
        <label className="block">รับสินค้า<select value={mode} onChange={(event) => setMode(event.target.value as "pickup" | "table")} className="ml-2 rounded border p-2"><option value="pickup">รับกลับ</option><option value="table">ที่โต๊ะ</option></select></label>
        {mode === "table" ? <label className="block">หมายเลขโต๊ะ<input aria-label="หมายเลขโต๊ะ" value={tableLabel} maxLength={40} onChange={(event) => setTableLabel(event.target.value)} className="ml-2 rounded border p-2" /></label> : null}
        <button type="button" onClick={() => void send()} disabled={lines.length === 0 || lines.length > 30 || lines.reduce((total, line) => total + line.qty, 0) > 100 || (mode === "table" && !tableLabel.trim())} className="min-h-14 w-full rounded-xl bg-[#2F6B3F] text-lg font-bold text-white disabled:opacity-40">ส่งรายการให้ร้าน</button>
      </section>
    </fieldset>}
  </main>;
}
