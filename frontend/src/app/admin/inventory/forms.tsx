"use client";

import { useActionState, useState } from "react";
import type { InventoryIngredient, InventoryState } from "@/server/inventory";
import { createIngredientAction, moveInventoryAction, saveRecipeAction, setStockPolicyAction, setThresholdAction, valueStockAction, type InventoryActionState } from "./actions";

const fieldClass = "min-h-11 rounded-lg border bg-background px-3";
const buttonClass = "min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50";
function Message({ state }: { state: InventoryActionState }) {
  return state ? <p role="status" className={state.success ? "text-green-700" : "text-red-700"}>{state.message}</p> : null;
}

export function CreateIngredientForm() {
  const [state, action, pending] = useActionState(createIngredientAction, null);
  return <form action={action} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
    <h2 className="font-semibold sm:col-span-2">เพิ่มวัตถุดิบ</h2>
    <label className="grid gap-1">ชื่อวัตถุดิบ<input name="name" required maxLength={100} disabled={pending} className={fieldClass} /></label>
    <label className="grid gap-1">หน่วยหลัก<select name="unit" disabled={pending} className={fieldClass}><option value="g">กรัม (g)</option><option value="ml">มิลลิลิตร (ml)</option><option value="unit">ชิ้น (unit)</option></select></label>
    <label className="grid gap-1">เตือนเมื่อเหลือไม่เกิน<input name="threshold" type="number" min="0" step="0.001" defaultValue="0" required disabled={pending} className={fieldClass} /></label>
    <button type="submit" disabled={pending} className={buttonClass}>{pending ? "กำลังบันทึก…" : "เพิ่มวัตถุดิบ"}</button>
    <Message state={state} />
  </form>;
}

export function StockMovementForm({ ingredient, requestId, receiveOnly = false }: { ingredient: InventoryIngredient; requestId: string; receiveOnly?: boolean }) {
  const [state, action, pending] = useActionState(moveInventoryAction, null);
  const [kind, setKind] = useState('receive');
  return <form action={action} className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-2">
    <input type="hidden" name="ingredientId" value={ingredient.id} />
    <input type="hidden" name="requestId" value={requestId} />
    {receiveOnly ? <input type="hidden" name="kind" value="receive" /> : <label className="grid gap-1">ประเภท<select name="kind" value={kind} onChange={event => setKind(event.target.value)} disabled={pending} className={fieldClass}>
      <option value="receive">รับเข้า</option><option value="waste">ของเสีย / หก</option><option value="adjust">ปรับยอด (+ / −)</option>
    </select></label>}
    <label className="grid gap-1">จำนวน ({ingredient.unit})<input name="quantity" type="number" min={receiveOnly ? "0.001" : undefined} step="0.001" required disabled={pending} className={fieldClass} /></label>
    {kind === 'receive' ? <label className="grid gap-1">ต้นทุนรับเข้ารวม (บาท)<input name="cost" type="number" min="0" max="21474836.47" step="0.01" required disabled={pending} className={fieldClass} /></label> : null}
    <p className="text-sm sm:col-span-2">ใช้ยอดต้นทุนวัตถุดิบที่ร้านรับรู้ รวมค่าขนส่งที่จัดสรรให้รายการนี้ ใช้หลักภาษีเดียวกันทุกครั้ง</p>
    <label className="grid gap-1 sm:col-span-2">เหตุผล<input name="reason" required maxLength={500} disabled={pending} className={fieldClass} /></label>
    <p className="text-sm text-muted-foreground sm:col-span-2">{receiveOnly ? "รับเข้าใช้จำนวนบวกเพื่อให้ POS ใช้งานต่อได้" : "รับเข้าและของเสียใช้จำนวนบวก การปรับยอดคือจำนวนที่เพิ่มหรือลดจากยอดปัจจุบัน"}</p>
    <button type="submit" disabled={pending} className={buttonClass}>{pending ? "กำลังบันทึก…" : receiveOnly ? "บันทึกรับเข้า" : "บันทึกการเคลื่อนไหว"}</button>
    <Message state={state} />
  </form>;
}

export function ThresholdForm({ ingredient }: { ingredient: InventoryIngredient }) {
  const [state, action, pending] = useActionState(setThresholdAction, null);
  return <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="ingredientId" value={ingredient.id} />
    <label className="grid gap-1">จุดเตือน ({ingredient.unit})<input name="threshold" type="number" min="0" step="0.001" defaultValue={ingredient.lowStockMilliunits / 1000} required disabled={pending} className={fieldClass} /></label>
    <button type="submit" disabled={pending} className={buttonClass}>บันทึกจุดเตือน</button>
    <Message state={state} />
  </form>;
}

function RecipeFields({ inventory, target }: { inventory: InventoryState; target: InventoryState["targets"][number] }) {
  const [state, action, pending] = useActionState(saveRecipeAction, null);
  return <form action={action} className="mt-4 grid gap-3">
    <input type="hidden" name="kind" value={target.kind} />
    <input type="hidden" name="targetId" value={target.id} />
    <div className="grid gap-3 sm:grid-cols-2">
      {inventory.ingredients.map((ingredient) => {
        const line = inventory.recipes.find((recipe) => recipe.targetKind === target.kind && recipe.targetId === target.id && recipe.ingredientId === ingredient.id);
        return <div key={ingredient.id} className="grid gap-1"><label className="grid gap-1">{ingredient.name} ({ingredient.unit})
          <input name={`quantity:${ingredient.id}`} type="number" min="0" step="0.001" defaultValue={line ? line.quantityMilliunits / 1000 : ""} disabled={pending} className={fieldClass} />
        </label>
        {target.kind === 'modifier' ? <label className="grid gap-1">ใช้แทนวัตถุดิบ
          <select name={`replaces:${ingredient.id}`} defaultValue={line?.replacesIngredientId ?? ''} disabled={pending} className={fieldClass}>
            <option value="">เพิ่มจากสูตรหลัก</option>
            {inventory.ingredients.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}
          </select>
        </label> : null}</div>;
      })}
    </div>
    <p className="text-sm text-muted-foreground">จำนวนต่อหนึ่งเมนู / ตัวเลือก เว้นว่างหรือใส่ 0 เพื่อลบวัตถุดิบจากสูตร การแก้ไขมีผลกับการขายครั้งถัดไปเท่านั้น</p>
    <button type="submit" disabled={pending} className={buttonClass}>{pending ? "กำลังบันทึก…" : "บันทึกสูตร"}</button>
    <Message state={state} />
  </form>;
}

export function RecipeEditor({ inventory }: { inventory: InventoryState }) {
  const [selected, setSelected] = useState(inventory.targets[0] ? `${inventory.targets[0].kind}:${inventory.targets[0].id}` : "");
  const target = inventory.targets.find((item) => `${item.kind}:${item.id}` === selected);
  return <section className="rounded-xl border bg-card p-4">
    <h2 className="text-lg font-semibold">สูตรวัตถุดิบ</h2>
    <p className="my-2 text-sm text-muted-foreground">สูตรตัวเลือกเพิ่มวัตถุดิบได้ เช่น เพิ่มช็อต หรือใช้แทนวัตถุดิบในสูตรหลัก เช่น นมโอ๊ตแทนนมวัว การขายจะหยุดเมื่อวัตถุดิบไม่พอ รับวัตถุดิบเข้าได้แม้หมด Pro</p>
    <label className="grid gap-1">เลือกเมนูหรือตัวเลือก<select value={selected} onChange={(event) => setSelected(event.target.value)} className={fieldClass}>
      {inventory.targets.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.kind === "modifier" ? "ตัวเลือก: " : "เมนู: "}{item.name}</option>)}
    </select></label>
    {target && inventory.ingredients.length > 0 ? <RecipeFields key={selected} inventory={inventory} target={target} /> : <p className="mt-3">เพิ่มเมนูและวัตถุดิบก่อนตั้งสูตร</p>}
  </section>;
}

export function StockPolicyForm({ mode }: { mode: 'payment' | 'preparation' }) {
  const [state, action, pending] = useActionState(setStockPolicyAction, null);
  return <form action={action} className="grid gap-3 rounded-xl border p-4">
    <label className="grid gap-1">ตัดวัตถุดิบเมื่อ<select name="mode" defaultValue={mode} disabled={pending} className={fieldClass}>
      <option value="payment">รับชำระเงิน</option><option value="preparation">กดเริ่มทำในคิวเครื่องดื่ม</option>
    </select></label>
    <p className="text-sm">โหมดเริ่มทำจะจองวัตถุดิบเมื่อรับเงิน และคืนยอดจองเมื่อคืนเงินก่อนเริ่มทำ ออเดอร์ที่ค้างจะยังจองวัตถุดิบข้ามวันจนกว่าจะทำหรือคืนเงิน</p>
    <button type="submit" disabled={pending} className={buttonClass}>บันทึกวิธีตัดสต็อก</button><Message state={state} />
  </form>;
}

export function StockValuationForm({ ingredient, requestId }: { ingredient: InventoryIngredient; requestId: string }) {
  const [state, action, pending] = useActionState(valueStockAction, null);
  return <form action={action} className="mt-3 grid gap-3 rounded border p-3">
    <input type="hidden" name="ingredientId" value={ingredient.id} /><input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="onHandMilliunits" value={ingredient.onHandMilliunits} />
    <p>ตั้งมูลค่าวัตถุดิบคงเหลือทั้งหมด {(ingredient.onHandMilliunits/1000).toLocaleString('th-TH')} {ingredient.unit} เพื่อเริ่มหรือแก้ต้นทุนเฉลี่ย ไม่เปลี่ยนจำนวนหรือต้นทุนบิลเดิม</p>
    <label className="grid gap-1">มูลค่าคงเหลือรวม (บาท)<input name="cost" type="number" min="0" max="21474836.47" step="0.01" required disabled={pending} className={fieldClass} /></label>
    <label className="grid gap-1">เหตุผล / อ้างอิงต้นทุน<input name="reason" maxLength={500} required disabled={pending} className={fieldClass} /></label>
    <button type="submit" disabled={pending || state?.success} className={buttonClass}>ยืนยันมูลค่าสต็อก</button><Message state={state} />
  </form>;
}
