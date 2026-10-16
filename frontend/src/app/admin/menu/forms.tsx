"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MENU_CATALOG, menuImageSrc } from "@/lib/menu-catalog";
import { satangToInput } from "@/lib/money";
import { thaiInitial } from "@/lib/thai";
import { TILE_COLORS, TILE_COLOR_LABELS, isTileColor, tileClasses, tileColorOf } from "@/lib/tile-colors";
import type { MenuActionState } from "./actions";
import { ReorderActions, SortableList } from "./sortable-list";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
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
  const [order, setOrder] = useState<Category[] | null>(null);
  const categoryInputId = useId();

  if (order) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <SortableList label="ลำดับหมวดหมู่บนหน้าขาย" items={order} onChange={setOrder} />
          <ReorderActions ids={order.map(({ id }) => id)} save={reorderCategoriesAction} onDone={() => setOrder(null)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
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
        {categories.length > 1 ? (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOrder(categories)}>จัดลำดับ</Button>
          </div>
        ) : null}
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
  tileColor?: string | null;
  earnsStamp: boolean;
  isActive: boolean;
  modifierGroupIds?: string[];
};

const PRODUCT_FORM_SECTIONS = [
  { key: "basics", label: "ข้อมูลหลัก" },
  { key: "modifiers", label: "ตัวเลือกเสริม" },
  { key: "image", label: "รูป" },
  { key: "sale", label: "การขาย" },
] as const;
type ProductFormSection = (typeof PRODUCT_FORM_SECTIONS)[number]["key"];

const sectionId = (formId: string, key: ProductFormSection) => `${formId}-section-${key}`;

/** Tracks which form section sits nearest the top of the viewport. */
function useActiveSection(formId: string) {
  const [active, setActive] = useState<ProductFormSection>("basics");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const top = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const key = PRODUCT_FORM_SECTIONS.find((section) => sectionId(formId, section.key) === top?.target.id)?.key;
      if (key) setActive(key);
    }, { rootMargin: "-15% 0px -65% 0px" });
    for (const { key } of PRODUCT_FORM_SECTIONS) {
      const element = document.getElementById(sectionId(formId, key));
      if (element) observer.observe(element);
    }
    // A short last section never reaches the band above; mark it once the page bottoms out with it in view.
    const last = PRODUCT_FORM_SECTIONS[PRODUCT_FORM_SECTIONS.length - 1].key;
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const lastTop = document.getElementById(sectionId(formId, last))?.getBoundingClientRect().top;
      if (atBottom && lastTop !== undefined && lastTop < window.innerHeight) setActive(last);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [formId]);
  return [active, setActive] as const;
}

function InlineCategoryCreator({ onCreated }: { onCreated: (categoryId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const create = () => startTransition(async () => {
    const formData = new FormData();
    formData.set("name", name);
    const result = await createCategoryAction({ message: null }, formData);
    if (!result.success || !result.id) {
      setMessage(result.message ?? "เพิ่มหมวดหมู่ไม่สำเร็จ");
      return;
    }
    onCreated(result.id);
    setName("");
    setMessage(null);
    setOpen(false);
  });

  if (!open) return <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setOpen(true)}>+ หมวดหมู่ใหม่</Button>;
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <Label htmlFor={inputId}>ชื่อหมวดหมู่ใหม่</Label>
      <div className="flex flex-wrap gap-2">
        {/* No name attribute: this field is not part of the product form. */}
        <Input id={inputId} value={name} maxLength={80} className="min-w-40 flex-1" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (name.trim()) create();
        }} />
        <Button type="button" disabled={pending || !name.trim()} onClick={create}>{pending ? "กำลังเพิ่ม…" : "เพิ่ม"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
      </div>
      <ErrorMessage message={message} />
    </div>
  );
}

type SubmittedValues = MenuActionState["values"];

function ProductFormJumpLinks({ formId, label, active, onJump }: { formId: string; label: string; active: ProductFormSection; onJump: (key: ProductFormSection) => void }) {
  return (
    <nav aria-label={label} className="overflow-x-auto bg-card md:sticky md:top-0 md:z-10">
      <ol className="flex min-w-max gap-5 border-b">
        {PRODUCT_FORM_SECTIONS.map(({ key, label: sectionLabel }) => (
          <li key={key} className="shrink-0">
            <a href={`#${sectionId(formId, key)}`} aria-current={active === key ? "location" : undefined} onClick={(event) => {
              // Scroll without adding a hash entry to the history.
              event.preventDefault();
              onJump(key);
              const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              document.getElementById(sectionId(formId, key))?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
            }} className={`inline-flex min-h-11 items-center border-b-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === key ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {sectionLabel}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function FormSection({ formId, sectionKey, children }: { formId: string; sectionKey: ProductFormSection; children: ReactNode }) {
  const label = PRODUCT_FORM_SECTIONS.find(({ key }) => key === sectionKey)?.label;
  return <section id={sectionId(formId, sectionKey)} aria-label={label} className="scroll-mt-16 border-t pt-5 first-of-type:border-t-0 first-of-type:pt-0">{children}</section>;
}

function BasicsFields({ formId, values, product, categories, categoryValue, onCategoryChange }: {
  formId: string;
  values: SubmittedValues;
  product?: ProductFormValues;
  categories: Category[];
  categoryValue: string;
  onCategoryChange: (categoryId: string) => void;
}) {
  const price = product?.basePriceSatang === undefined ? "" : satangToInput(product.basePriceSatang);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>ชื่อสินค้า</Label>
        <Input id={`${formId}-name`} name="name" defaultValue={typeof values?.name === "string" ? values.name : product?.name} required maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${formId}-price`}>ราคา (บาท)</Label>
        <Input id={`${formId}-price`} name="price" inputMode="decimal" defaultValue={typeof values?.price === "string" ? values.price : price} required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${formId}-category`}>หมวดหมู่</Label>
        <Select name="categoryId" value={categoryValue} onValueChange={(value) => onCategoryChange(typeof value === "string" ? value : "__none__")} itemToStringValue={(value: string | null) => value === "__none__" ? "" : value ?? ""}>
          <SelectTrigger id={`${formId}-category`}><SelectValue>{(value: string | null) => value === "__none__" ? "ไม่มีหมวดหมู่" : categories.find((category) => category.id === value)?.name ?? "เลือกหมวดหมู่"}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">ไม่มีหมวดหมู่</SelectItem>
            {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <InlineCategoryCreator onCreated={onCategoryChange} />
      </div>
    </div>
  );
}

function modifierSelectionLabel({ minSelect, maxSelect }: ModifierGroup) {
  if (minSelect === 0) return "ไม่บังคับ";
  return minSelect === maxSelect ? `ต้องเลือก ${minSelect}` : `เลือกได้สูงสุด ${maxSelect}`;
}

function ModifierFields({ formId, modifierGroups, selectedIds }: { formId: string; modifierGroups: ModifierGroup[]; selectedIds: Set<string> }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  return (
    <>
      {modifierGroups.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">ตัวเลือกเสริม</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {modifierGroups.map((group) => {
              const hasOptions = group.modifierNames.length > 0;
              const selected = selectedIds.has(group.id);
              return (
                <label key={group.id} htmlFor={`${formId}-modifier-${group.id}`} className={`flex items-start gap-3 rounded-lg border p-3 ${hasOptions ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                  <Checkbox id={`${formId}-modifier-${group.id}`} name="modifierGroupIds" value={group.id} defaultChecked={selected} disabled={!hasOptions} />
                  {!hasOptions && selected ? <input type="hidden" name="modifierGroupIds" value={group.id} /> : null}
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">{group.name} <span className="text-muted-foreground">({modifierSelectionLabel(group)})</span></span>
                    <span className="block text-xs text-muted-foreground">{hasOptions ? group.modifierNames.join(" · ") : "ยังไม่มีตัวเลือก"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : <p className="text-sm text-muted-foreground">ยังไม่มีตัวเลือกเสริม</p>}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 text-sm">
        <Link href="/admin/modifiers" target="_blank" rel="noopener" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">จัดการตัวเลือกเสริม ↗</Link>
        <button type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className="min-h-11 text-muted-foreground hover:text-foreground disabled:opacity-50">{refreshing ? "กำลังโหลด…" : "โหลดใหม่"}</button>
      </p>
    </>
  );
}

function ImageFields({ values, product }: { values: SubmittedValues; product?: ProductFormValues }) {
  const suggestedImage = product && !product.imageUrl
    ? MENU_CATALOG.find((item) => item.name === product.name)
    : undefined;
  const isChecked = (src: string) => {
    if (typeof values?.imageUrl === "string") return values.imageUrl === src;
    if (product?.imageUrl) return product.imageUrl === src;
    return suggestedImage ? src === `/assets/menu/${suggestedImage.slug}.webp` : src === "";
  };
  const [color, setColor] = useState(() => {
    const submitted = typeof values?.tileColor === "string" ? values.tileColor : product?.tileColor;
    return isTileColor(submitted) ? submitted : "";
  });
  const previewColor = isTileColor(color) ? color : tileColorOf({ name: product?.name ?? "" });
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">สีเมื่อไม่มีรูป</legend>
        <div className="flex flex-wrap gap-2">
          {(["", ...TILE_COLORS] as const).map((key) => (
            <label key={key || "auto"} className="cursor-pointer">
              <input type="radio" name="tileColor" value={key} checked={color === key} onChange={() => setColor(key)} className="peer sr-only" />
              <span className={`flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-xs ring-foreground ring-offset-2 ring-offset-card peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-ring ${key ? tileClasses(key) : "border border-dashed text-muted-foreground"}`}>
                {key ? <span className="sr-only">{TILE_COLOR_LABELS[key]}</span> : "อัตโนมัติ"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">รูปสินค้า</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 text-sm has-[:checked]:border-primary">
            <input type="radio" name="imageUrl" value="" defaultChecked={isChecked("")} className="accent-primary" />
            <span aria-hidden="true" className={`flex size-20 items-center justify-center rounded-md text-3xl font-bold ${tileClasses(previewColor)}`}>{product?.name ? thaiInitial(product.name) : null}</span>
            <span>ไม่มีรูป</span>
          </label>
          {imageChoices.map((image) => (
            <label key={image.src} className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-2 text-sm has-[:checked]:border-primary">
              <input type="radio" name="imageUrl" value={image.src} defaultChecked={isChecked(image.src)} className="accent-primary" />
              <Image src={image.src} alt={image.label} width={80} height={80} className="size-20 rounded-md object-cover" />
              <span>{image.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function SaleFields({ formId, values, product }: { formId: string; values: SubmittedValues; product?: ProductFormValues }) {
  const checked = (field: "earnsStamp" | "isActive") => {
    const submitted = values?.[field];
    return typeof submitted === "string" ? submitted === "on" : product?.[field] ?? true;
  };
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={`${formId}-earns-stamp`} className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox id={`${formId}-earns-stamp`} name="earnsStamp" value="on" defaultChecked={checked("earnsStamp")} />
        ได้รับแสตมป์
      </label>
      <label htmlFor={`${formId}-active`} className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox id={`${formId}-active`} name="isActive" value="on" defaultChecked={checked("isActive")} />
        แสดงบนหน้าขาย
      </label>
    </div>
  );
}

function ProductFormStatus({ state, isEdit, returnHref }: { state: MenuActionState; isEdit: boolean; returnHref?: string }) {
  if (!state.success) return <span className="mr-auto"><ErrorMessage message={state.message} /></span>;
  const link = isEdit ? (returnHref ? { href: returnHref, label: "กลับไปรายการ" } : null) : state.id ? { href: `/admin/menu/${state.id}`, label: "แก้ไข" } : null;
  return (
    <p role="status" aria-live="polite" className="mr-auto text-sm text-muted-foreground">
      {isEdit ? "บันทึกแล้ว" : state.message}
      {link ? <> · <Link href={link.href} className="underline underline-offset-4 hover:text-foreground">{link.label}</Link></> : null}
    </p>
  );
}

export function ProductForm({
  categories,
  modifierGroups = [],
  product,
  action,
  submitLabel,
  returnHref,
}: {
  categories: Category[];
  modifierGroups?: ModifierGroup[];
  product?: ProductFormValues;
  action: ProductAction;
  submitLabel: string;
  returnHref?: string;
}) {
  const [state, formAction] = useActionState(action, { message: null });
  const [categoryValue, setCategoryValue] = useState(product?.categoryId ?? categories[0]?.id ?? "__none__");
  const formId = useId();
  const [activeSection, setActiveSection] = useActiveSection(formId);
  const values = state.values;
  const selectedGroupIds = new Set(Array.isArray(values?.modifierGroupIds) ? values.modifierGroupIds : product?.modifierGroupIds ?? []);
  return (
    <form key={JSON.stringify([values ?? state.success ?? "initial", state.revision])} action={formAction} className="space-y-5 md:[&_input]:scroll-mt-16">
      <ProductFormJumpLinks formId={formId} label={product ? "ส่วนของข้อมูลสินค้า" : "ส่วนของสินค้าใหม่"} active={activeSection} onJump={setActiveSection} />
      <FormSection formId={formId} sectionKey="basics"><BasicsFields formId={formId} values={values} product={product} categories={categories} categoryValue={categoryValue} onCategoryChange={setCategoryValue} /></FormSection>
      <FormSection formId={formId} sectionKey="modifiers"><ModifierFields formId={formId} modifierGroups={modifierGroups} selectedIds={selectedGroupIds} /></FormSection>
      <FormSection formId={formId} sectionKey="image"><ImageFields values={values} product={product} /></FormSection>
      <FormSection formId={formId} sectionKey="sale"><SaleFields formId={formId} values={values} product={product} /></FormSection>
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 border-t bg-card/95 py-3 backdrop-blur">
        <ProductFormStatus state={state} isEdit={product !== undefined} returnHref={returnHref} />
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
