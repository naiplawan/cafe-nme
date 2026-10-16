"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MENU_CATALOG, menuImageSrc } from "@/lib/menu-catalog";
import { satangToInput } from "@/lib/money";
import type { MenuActionState } from "./actions";
import {
  createCategoryAction,
  deleteCategoryAction,
  deleteProductAction,
  importStockMenuAction,
  renameCategoryAction,
} from "./actions";

type Category = { id: string; name: string };
type ModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifierNames: string[];
};
type ProductAction = (state: MenuActionState, formData: FormData) => Promise<MenuActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : label}</Button>;
}

function ErrorMessage({ message }: { message: string | null }) {
  return message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null;
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [createState, createAction] = useActionState(createCategoryAction, { message: null });
  const categoryInputId = useId();

  return (
    <Card>
      <CardHeader><CardTitle>หมวดหมู่</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form action={createAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor={categoryInputId}>เพิ่มหมวดหมู่</Label>
            <Input id={categoryInputId} name="name" required maxLength={80} />
          </div>
          <SubmitButton label="เพิ่มหมวดหมู่" />
          <ErrorMessage message={createState.message} />
          {createState.success ? <p className="text-sm text-muted-foreground" role="status" aria-live="polite">บันทึกแล้ว</p> : null}
        </form>
        {categories.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</p>}
      </CardContent>
    </Card>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const rename = renameCategoryAction.bind(null, category.id);
  const remove = deleteCategoryAction.bind(null, category.id);
  const [state, action] = useActionState(rename, { message: null });

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <form action={action} className="flex min-w-56 flex-1 items-center gap-2">
        <Input aria-label={`ชื่อหมวดหมู่ ${category.name}`} name="name" defaultValue={category.name} required maxLength={80} />
        <SubmitButton label="บันทึก" />
        <ErrorMessage message={state.message} />
        {state.success ? <p className="text-sm text-muted-foreground" role="status" aria-live="polite">บันทึกแล้ว</p> : null}
      </form>
      <ConfirmSubmit action={remove} destructive confirmLabel="ลบ" message={`ลบหมวดหมู่ “${category.name}” หรือไม่? สินค้าจะยังอยู่โดยไม่มีหมวดหมู่`}>
        <Button type="submit" variant="destructive">ลบ</Button>
      </ConfirmSubmit>
    </li>
  );
}

const imageChoices = [
  { src: "/assets/product-americano.png", label: "อเมริกาโน่" },
  { src: "/assets/product-latte.png", label: "ลาเต้" },
  { src: "/assets/product-thai-tea.png", label: "ชาไทย" },
  { src: "/assets/product-matcha-latte.png", label: "มัทฉะลาเต้" },
  ...MENU_CATALOG.map((item) => ({ src: menuImageSrc(item.slug), label: item.name })),
];

export type ProductFormValues = {
  name: string;
  basePriceSatang?: number;
  categoryId: string | null;
  imageUrl: string | null;
  earnsStamp: boolean;
  isActive: boolean;
  modifierGroupIds?: string[];
};

export function ProductForm({
  categories,
  modifierGroups = [],
  product,
  action,
  submitLabel,
}: {
  categories: Category[];
  modifierGroups?: ModifierGroup[];
  product?: ProductFormValues;
  action: ProductAction;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { message: null });
  const formId = useId();
  const values = state.values;
  const submittedGroupIds = new Set(Array.isArray(values?.modifierGroupIds) ? values.modifierGroupIds : product?.modifierGroupIds ?? []);
  const suggestedImage = product && !product.imageUrl
    ? MENU_CATALOG.find((item) => item.name === product.name)
    : undefined;
  return (
    <form key={JSON.stringify([values ?? state.success ?? "initial", state.revision])} action={formAction} className="space-y-6 pb-20">
      <Card>
        <CardHeader><CardTitle>{product ? "ข้อมูลสินค้า" : "เพิ่มสินค้า"}</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-name`}>ชื่อสินค้า</Label>
            <Input id={`${formId}-name`} name="name" defaultValue={typeof values?.name === "string" ? values.name : product?.name} required maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-price`}>ราคา (บาท)</Label>
            <Input id={`${formId}-price`} name="price" inputMode="decimal" defaultValue={typeof values?.price === "string" ? values.price : product?.basePriceSatang === undefined ? "" : satangToInput(product.basePriceSatang)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-category`}>หมวดหมู่</Label>
            <Select name="categoryId" defaultValue={typeof values?.categoryId === "string" ? values.categoryId || "__none__" : product?.categoryId ?? categories[0]?.id ?? "__none__"} itemToStringValue={(value: string | null) => value === "__none__" ? "" : value ?? ""}>
              <SelectTrigger id={`${formId}-category`}><SelectValue>{(value: string | null) => value === "__none__" ? "ไม่มีหมวดหมู่" : categories.find((category) => category.id === value)?.name ?? "เลือกหมวดหมู่"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่มีหมวดหมู่</SelectItem>
                {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <label htmlFor={`${formId}-earns-stamp`} className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox id={`${formId}-earns-stamp`} name="earnsStamp" value="on" defaultChecked={typeof values?.earnsStamp === "string" ? values.earnsStamp === "on" : product?.earnsStamp ?? true} />
              ได้รับแสตมป์
            </label>
            <label htmlFor={`${formId}-active`} className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox id={`${formId}-active`} name="isActive" value="on" defaultChecked={typeof values?.isActive === "string" ? values.isActive === "on" : product?.isActive ?? true} />
              แสดงบนหน้าขาย
            </label>
          </div>
          {modifierGroups.length > 0 ? (
            <fieldset className="space-y-3 sm:col-span-2">
              <legend className="text-sm font-medium">ตัวเลือกเสริม</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {modifierGroups.map((group) => {
                  const selectionLabel = group.minSelect === 0
                    ? "ไม่บังคับ"
                    : group.minSelect === group.maxSelect
                      ? `ต้องเลือก ${group.minSelect}`
                      : `เลือกได้สูงสุด ${group.maxSelect}`;
                  const hasOptions = group.modifierNames.length > 0;
                  const selected = submittedGroupIds.has(group.id);
                  return (
                    <label key={group.id} htmlFor={`${formId}-modifier-${group.id}`} className={`flex items-start gap-3 rounded-lg border p-3 ${hasOptions ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                      <Checkbox id={`${formId}-modifier-${group.id}`} name="modifierGroupIds" value={group.id} defaultChecked={selected} disabled={!hasOptions} />
                      {!hasOptions && selected ? <input type="hidden" name="modifierGroupIds" value={group.id} /> : null}
                      <span className="space-y-1">
                        <span className="block text-sm font-medium">{group.name} <span className="text-muted-foreground">({selectionLabel})</span></span>
                        <span className="block text-xs text-muted-foreground">{hasOptions ? group.modifierNames.join(" · ") : "ยังไม่มีตัวเลือก"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : product ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
              <Link href="/admin/modifiers" className="underline underline-offset-4">ยังไม่มีตัวเลือกเสริม — ไปสร้างที่หน้าตัวเลือกเสริม</Link>
            </div>
          ) : null}
          <fieldset className="space-y-3 sm:col-span-2">
              <legend className="text-sm font-medium">รูปสินค้า</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 text-sm has-[:checked]:border-primary">
                  <input type="radio" name="imageUrl" value="" defaultChecked={typeof values?.imageUrl === "string" ? !values.imageUrl : !product?.imageUrl && !suggestedImage} className="accent-primary" />
                  <span className="flex h-20 items-center text-muted-foreground">ไม่มีรูป</span>
                </label>
                {imageChoices.map((image) => (
                  <label key={image.src} className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 text-sm has-[:checked]:border-primary">
                    <input type="radio" name="imageUrl" value={image.src} defaultChecked={typeof values?.imageUrl === "string" ? values.imageUrl === image.src : product?.imageUrl === image.src || (!product?.imageUrl && suggestedImage !== undefined && image.src === `/assets/menu/${suggestedImage.slug}.webp`)} className="accent-primary" />
                    <Image src={image.src} alt={image.label} width={80} height={80} className="size-20 rounded-md object-cover" />
                    <span>{image.label}</span>
                  </label>
                ))}
              </div>
          </fieldset>
          <ErrorMessage message={state.message} />
        </CardContent>
      </Card>
      {state.success ? <p className="text-sm text-muted-foreground" role="status" aria-live="polite">บันทึกแล้ว</p> : null}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(59,42,32,0.08)] backdrop-blur sm:mx-0 sm:rounded-t-xl sm:px-5">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

export function ImportStockMenu({
  products,
  emptyState = false,
}: {
  products: { name: string }[];
  emptyState?: boolean;
}) {
  const [state, action, pending] = useActionState(importStockMenuAction, { message: null });
  const existingNames = new Set(products.map((product) => product.name));
  const missingCount = MENU_CATALOG.filter((item) => !existingNames.has(item.name)).length;
  if (missingCount === 0 && !state.message) return null;
  if (missingCount === 0 && state.message) {
    return <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{state.message}</p>;
  }
  if (emptyState) {
    return (
      <div className="flex flex-wrap justify-center gap-3">
        <ConfirmSubmit action={action} message={`เพิ่มเมนูที่ยังไม่มี ${missingCount} รายการ พร้อมรูปและราคาตัวอย่างหรือไม่?`} confirmLabel="เพิ่ม">
          <Button type="submit" disabled={pending || missingCount === 0}>
            {pending ? "กำลังเพิ่ม…" : "เพิ่มเมนูตัวอย่างที่ยังไม่มี"}
          </Button>
        </ConfirmSubmit>
        <OpenProductSectionButton label="เพิ่มสินค้าเอง" variant="outline" />
        {state.message ? <p className="basis-full text-sm text-muted-foreground" role="status" aria-live="polite">{state.message}</p> : null}
      </div>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-3">
        <div>
          <p className="font-semibold">เพิ่มเมนูตัวอย่างพร้อมรูป</p>
          {state.message ? <p className="mt-1 text-sm text-muted-foreground" role="status" aria-live="polite">{state.message}</p> : null}
        </div>
        <ConfirmSubmit action={action} message={`เพิ่มเมนูที่ยังไม่มี ${missingCount} รายการ พร้อมรูปและราคาตัวอย่างหรือไม่?`} confirmLabel="เพิ่ม">
          <Button type="submit" variant="outline" disabled={pending || missingCount === 0}>
            {pending ? "กำลังเพิ่ม…" : "เพิ่มเมนูตัวอย่างที่ยังไม่มี"}
          </Button>
        </ConfirmSubmit>
      </CardContent>
    </Card>
  );
}

export function OpenProductSectionButton({
  label = "เพิ่มสินค้า",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
} = {}) {
  return <Button type="button" onClick={() => {
    const section = document.querySelector<HTMLDetailsElement>("[data-add-product-section]");
    if (!section) return;
    section.open = true;
    section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }} variant={variant}>{label}</Button>;
}

export function DeleteProductForm({ productId, name }: { productId: string; name: string }) {
  const action = deleteProductAction.bind(null, productId);
  return (
    <ConfirmSubmit action={action} destructive confirmLabel="ลบ" message={`ลบสินค้า “${name}” หรือไม่?`}>
      <Button type="submit" variant="destructive">ลบสินค้า</Button>
    </ConfirmSubmit>
  );
}
