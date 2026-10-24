"use client";
import { useRef, useState } from "react";
import type { PosMenu, PosProduct } from "@/lib/pricing";
import type { TrialSummary } from "@/server/trial-checkout";
import { trialCheckoutAction } from "./actions";
const requiredModifiers = (product?: PosProduct) => product?.groups.flatMap((group) => group.modifiers.slice(0, group.minSelect).map((modifier) => modifier.id)) ?? [];
export function TrialForm({ menu }: { menu: PosMenu }) {
  const products = menu.products.filter((product) => !product.soldOut);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((entry) => entry.id === productId);
  const [modifiers, setModifiers] = useState(requiredModifiers(product));
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<"cash" | "promptpay">("cash");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<TrialSummary | null>(null);
  const [error, setError] = useState("");
  const active = useRef(false);
  async function run() {
    if (!product || active.current) { return; }
    active.current = true; setBusy(true); setError(""); setSummary(null);
    try {
      const result = await trialCheckoutAction([{ productId, qty, modifierIds: modifiers }], method);
      if (result.ok) { setSummary(result.summary); } else { setError(result.message); }
    } catch { setError("เชื่อมต่อไม่สำเร็จ ยังยืนยันผลทดลองไม่ได้ กรุณาลองใหม่"); }
    finally { active.current = false; setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border bg-card p-5" aria-busy={busy}>
    <h2 className="text-xl font-semibold">ทดลองออกบิล</h2>
    <p>ทดสอบระบบโดยไม่บันทึกยอดขาย ไม่เปลี่ยนสต็อกหรือแต้ม และไม่ต้องโอนเงินจริง</p>
    {products.length === 0 ? <p>เพิ่มเมนูที่พร้อมขายก่อนเริ่มทดลอง</p> : <fieldset disabled={busy} className="space-y-4">
      <label className="block">เมนู<select className="ml-3 rounded border p-2" value={productId} onChange={(event) => { setProductId(event.target.value); setModifiers(requiredModifiers(products.find((entry) => entry.id === event.target.value))); }}>
        {products.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select></label>
      {product?.groups.map((group) => <fieldset key={group.id}><legend>{group.name} (เลือก {group.minSelect}–{group.maxSelect})</legend>
        {group.modifiers.map((modifier) => <label key={modifier.id} className="mr-4 inline-flex gap-2"><input type="checkbox" checked={modifiers.includes(modifier.id)} onChange={(event) => setModifiers((current) => event.target.checked ? [...current, modifier.id] : current.filter((id) => id !== modifier.id))} />{modifier.name}</label>)}
      </fieldset>)}
      <label className="block">จำนวน<input aria-label="จำนวน" type="number" min={1} max={99} value={qty} onChange={(event) => setQty(Number(event.target.value))} className="ml-3 w-24 rounded border p-2" /></label>
      <label className="block">วิธีทดลอง<select value={method} onChange={(event) => setMethod(event.target.value as "cash" | "promptpay")} className="ml-3 rounded border p-2"><option value="cash">เงินสดจำลอง</option><option value="promptpay">พร้อมเพย์จำลอง · ไม่โอนเงิน</option></select></label>
      <button type="button" disabled={busy || !Number.isInteger(qty) || qty < 1 || qty > 99 || product?.groups.some((group) => { const count = group.modifiers.filter((modifier) => modifiers.includes(modifier.id)).length; return count < group.minSelect || count > group.maxSelect; })} onClick={() => void run()} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "กำลังทดลอง…" : "ทดลองออกบิล"}</button>
    </fieldset>}
    {error ? <p role="alert" className="rounded-lg bg-red-100 p-3 text-red-900">{error}</p> : null}
    {summary ? <p role="status" className="rounded-lg bg-green-100 p-3 text-green-900">ทดลองสำเร็จ · {summary.itemCount} ชิ้น · ฿{(summary.totalSatang / 100).toLocaleString("th-TH")} · ไม่มีการบันทึกยอดขาย</p> : null}
  </section>;
}
