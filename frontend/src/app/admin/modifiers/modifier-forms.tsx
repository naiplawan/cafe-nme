"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { createModifierAction, deleteModifierAction, deleteModifierGroupAction, ModifierFormState } from "./actions";
import { createStandardModifierGroupsAction, setGroupProductsAction } from "./actions";

type GroupAction = (
  state: ModifierFormState,
  formData: FormData,
) => Promise<ModifierFormState>;
function FormFeedback({ state }: { state: ModifierFormState }) {
  if (state.error) {
    return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  }
  if (state.success) {
    return <p role="status" className="text-sm text-muted-foreground">บันทึกแล้ว</p>;
  }
  return null;
}

export function ModifierGroupForm({
  action,
  group,
}: {
  action: GroupAction;
  group?: { id: string; name: string; minSelect: number; maxSelect: number };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const prefix = group?.id ?? "new";

  useEffect(() => {
    if (!state.createdGroupId) return;
    const input = document.getElementById(`modifier-name-${state.createdGroupId}`);
    const details = input?.closest("details");
    if (details) details.open = true;
    input?.focus();
  }, [state.createdGroupId]);

  const nameValue = state.values?.name ?? group?.name;
  const minValue = state.values?.minSelect ?? String(group?.minSelect ?? 0);
  const maxValue = state.values?.maxSelect ?? String(group?.maxSelect ?? 1);

  return (
    <form action={formAction} className="space-y-3">
      {group && <input type="hidden" name="groupId" value={group.id} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.55fr)_minmax(130px,0.55fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`group-name-${prefix}`}>ชื่อกลุ่ม</Label>
          <Input
            id={`group-name-${prefix}`}
            name="name"
            placeholder="เช่น ความหวาน"
            defaultValue={nameValue}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`group-min-${prefix}`}>ต้องเลือกอย่างน้อย</Label>
          <Input
            id={`group-min-${prefix}`}
            name="minSelect"
            type="number"
            min={0}
            max={20}
            step={1}
            defaultValue={minValue}
            required
          />
          <p className="text-xs text-muted-foreground">0 = ไม่บังคับ</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`group-max-${prefix}`}>เลือกได้สูงสุด</Label>
          <Input
            id={`group-max-${prefix}`}
            name="maxSelect"
            type="number"
            min={1}
            max={20}
            step={1}
            defaultValue={maxValue}
            required
          />
          <p className="text-xs text-muted-foreground">จำนวนตัวเลือกสูงสุด</p>
        </div>
        <Button type="submit" disabled={pending}>
          {!group && <Plus aria-hidden="true" />}
          {pending ? "กำลังบันทึก…" : group ? "บันทึกกลุ่ม" : "เพิ่มกลุ่ม"}
        </Button>
      </div>
      <FormFeedback state={state} />
    </form>
  );
}

export function StandardModifierPresetForm() {
  const [state, formAction, pending] = useActionState(createStandardModifierGroupsAction, {});
  return <div className="space-y-2"><ConfirmSubmit action={formAction} message="เพิ่มชุดตัวเลือกมาตรฐานสำหรับร้านกาแฟหรือไม่? กลุ่มที่มีชื่อซ้ำจะข้ามไป" confirmLabel="เพิ่ม">
    <Button type="submit" variant="outline" disabled={pending}>{pending ? "กำลังเพิ่ม…" : "ใช้ชุดตัวเลือกมาตรฐาน"}</Button>
  </ConfirmSubmit>{state.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}</div>;
}

type ProductCategory = { id: string; name: string; products: { id: string; name: string }[] };

export function GroupProductsForm({
  groupId,
  selectedProductIds,
  productsByCategory,
}: {
  groupId: string;
  selectedProductIds: string[];
  productsByCategory: ProductCategory[];
}) {
  const [state, formAction, pending] = useActionState(setGroupProductsAction, {});
  const formId = useId();
  const [selected, setSelected] = useState(() => new Set(selectedProductIds));
  const selectedCount = selected.size;

  function toggleProduct(productId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }

  function toggleCategory(category: ProductCategory, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const product of category.products) {
        if (checked) next.add(product.id);
        else next.delete(product.id);
      }
      return next;
    });
  }

  return <section className="space-y-3" aria-label="สินค้าที่ใช้กลุ่มนี้">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">สินค้าที่ใช้กลุ่มนี้</h3><p className="text-sm text-muted-foreground">เลือกสินค้าที่ต้องการให้แสดงตัวเลือกนี้</p></div>
      <span className="text-sm font-medium tabular-nums">เลือกแล้ว {selectedCount} สินค้า</span>
    </div>
    {productsByCategory.length ? <form action={formAction} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      {productsByCategory.map((category) => {
        const categoryProductIds = category.products.map((product) => product.id);
        const categorySelectedCount = categoryProductIds.filter((id) => selected.has(id)).length;
        return <fieldset key={category.id} className="rounded-lg border p-3">
          <legend className="sr-only">{category.name}</legend>
          <div className="mb-2 flex min-h-10 items-center justify-between gap-3 border-b pb-2">
            <h4 className="font-medium">{category.name} <span className="text-xs text-muted-foreground">({categorySelectedCount}/{category.products.length})</span></h4>
            <label htmlFor={`${formId}-category-${category.id}`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox id={`${formId}-category-${category.id}`} checked={categorySelectedCount === category.products.length} onCheckedChange={(checked) => toggleCategory(category, checked === true)} />
              เลือกทั้งหมวด
            </label>
          </div>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {category.products.map((product) => <label key={product.id} htmlFor={`${formId}-product-${product.id}`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox id={`${formId}-product-${product.id}`} checked={selected.has(product.id)} onCheckedChange={(checked) => toggleProduct(product.id, checked === true)} />
              <span className="truncate">{product.name}</span>
              {selected.has(product.id) && <input type="hidden" name="productIds" value={product.id} />}
            </label>)}
          </div>
        </fieldset>;
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : `บันทึก · ${selectedCount} รายการ`}</Button>
        {state.success && <p role="status" className="text-sm text-muted-foreground">บันทึกแล้ว</p>}
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form> : <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">เพิ่มสินค้าก่อน แล้วจึงเลือกสินค้าที่ใช้กลุ่มนี้ได้</p>}
  </section>;
}

export function DeleteGroupForm({
  action,
  groupId,
  name,
  productCount,
}: {
  action: typeof deleteModifierGroupAction;
  groupId: string;
  name: string;
  productCount: number;
}) {
  return (
    <ConfirmSubmit action={action} destructive confirmLabel="ลบ" message={() => {
      const impact = productCount ? ` กลุ่มนี้ผูกกับ ${productCount} เมนู และจะถูกนำออกจากเมนูเหล่านั้นด้วย` : "";
      return `ลบกลุ่ม “${name}” และตัวเลือกทั้งหมดหรือไม่?${impact}`;
    }}>
      <input type="hidden" name="groupId" value={groupId} />
      <Button type="submit" variant="destructive" size="sm"><Trash2 aria-hidden="true" />ลบกลุ่มและตัวเลือก</Button>
    </ConfirmSubmit>
  );
}

export function AddModifierForm({
  action,
  groupId,
}: {
  action: typeof createModifierAction;
  groupId: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.4fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`modifier-name-${groupId}`}>ชื่อตัวเลือก</Label>
          <Input
            id={`modifier-name-${groupId}`}
            name="name"
            placeholder="เช่น 50%"
            defaultValue={state.values?.name}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`modifier-price-${groupId}`}>ราคาเพิ่ม (บาท)</Label>
          <Input
            id={`modifier-price-${groupId}`}
            name="priceDelta"
            inputMode="decimal"
            placeholder="เช่น 15 หรือ -5 บาท"
            defaultValue={state.values?.priceDelta}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden="true" />
          {pending ? "กำลังเพิ่ม…" : "เพิ่มตัวเลือก"}
        </Button>
      </div>
      <FormFeedback state={state} />
    </form>
  );
}

export function DeleteModifierForm({
  action,
  modifierId,
  name,
}: {
  action: typeof deleteModifierAction;
  modifierId: string;
  name: string;
}) {
  return (
    <ConfirmSubmit action={action} destructive confirmLabel="ลบ" message={`ลบตัวเลือก “${name}” หรือไม่?`}>
      <input type="hidden" name="modifierId" value={modifierId} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 aria-hidden="true" />ลบ</Button>
    </ConfirmSubmit>
  );
}
