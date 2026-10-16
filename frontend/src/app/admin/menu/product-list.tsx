"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBaht } from "@/lib/money";
import { bulkUpdateProductsAction, clearSoldOutProductsAction } from "./actions";

type Product = {
  id: string;
  name: string;
  basePriceSatang: number;
  imageUrl: string | null;
  isActive: boolean;
  earnsStamp: boolean;
  soldOut: boolean;
  categoryId: string | null;
  categoryName: string | null;
};

type Category = { id: string; name: string };

export function ProductEditLink({ href }: { href: string }) {
  return <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>แก้ไข</Link>;
}

export function getValidSelectedProductIds(selectedIds: readonly string[], productIds: readonly string[]): string[] {
  const validIds = new Set(productIds);
  return [...new Set(selectedIds)].filter((id) => validIds.has(id));
}

export function getSelectionVisibilityCounts(selectedIds: readonly string[], visibleIds: readonly string[]) {
  const visibleSet = new Set(visibleIds);
  const visible = selectedIds.filter((id) => visibleSet.has(id)).length;
  return { visible, hidden: selectedIds.length - visible };
}

export function shouldConfirmBulkAction(selectedCount: number) {
  return selectedCount > 0;
}

export function shouldConfirmSoldOutReset(soldOutCount: number) {
  return soldOutCount > 0;
}

export function hasActiveProductFilters(search: string, category: string, status: string) {
  return search.trim().length > 0 || category !== "all" || status !== "all";
}

export function MenuProductList({
  products,
  categories,
  emptyStateAction,
}: {
  products: Product[];
  categories: Category[];
  emptyStateAction?: ReactNode;
}) {
  const [state, action] = useActionState(bulkUpdateProductsAction, { message: null });
  const [soldOutState, clearSoldOut] = useActionState(clearSoldOutProductsAction, { message: null });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const validSelectedIds = useMemo(() => getValidSelectedProductIds(selectedIds, products.map((product) => product.id)), [products, selectedIds]);
  const selectedSet = useMemo(() => new Set(validSelectedIds), [validSelectedIds]);
  const filtered = useMemo(() => products.filter((product) =>
    product.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (category === "all" || (category === "none" ? product.categoryId === null : product.categoryId === category)) &&
    (status === "all" || (status === "soldOut" ? product.soldOut : status === "active" ? product.isActive : !product.isActive)),
  ), [products, search, category, status]);
  const filteredIds = useMemo(() => new Set(filtered.map((product) => product.id)), [filtered]);
  const selectionVisibility = getSelectionVisibilityCounts(validSelectedIds, [...filteredIds]);
  const soldOutCount = products.filter((product) => product.soldOut).length;
  const groups = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; products: Product[] }>();
    for (const product of filtered) {
      const key = product.categoryId ?? "uncategorized";
      const group = grouped.get(key) ?? { id: key, name: product.categoryName ?? "ไม่มีหมวดหมู่", products: [] };
      group.products.push(product);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [filtered]);

  if (groups.length === 0) {
    if (products.length === 0) {
      return <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">ยังไม่มีสินค้า</p>
          {emptyStateAction}
        </CardContent>
      </Card>;
    }
    return <div className="space-y-4">
      <ProductFilters products={products} categories={categories} search={search} setSearch={setSearch} category={category} setCategory={setCategory} status={status} setStatus={setStatus} />
      <Card><CardContent className="space-y-3 py-8 text-center text-sm text-muted-foreground">
        <p>ไม่พบสินค้าตามตัวกรอง</p>
        {hasActiveProductFilters(search, category, status) && <Button type="button" variant="outline" onClick={() => {
          setSearch("");
          setCategory("all");
          setStatus("all");
        }}>ล้างตัวกรอง</Button>}
        {validSelectedIds.length > 0 && <div className="flex flex-wrap items-center justify-center gap-2"><span>ยังเลือกไว้ {validSelectedIds.length} รายการ · ซ่อนจากตัวกรอง {selectionVisibility.hidden} รายการ</span><Button type="button" variant="outline" onClick={() => setSelectedIds([])}>ล้างที่เลือก</Button></div>}
      </CardContent></Card>
    </div>;
  }

  return (
    <div className="space-y-4">
      <ConfirmSubmit action={clearSoldOut} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3" shouldConfirm={() => shouldConfirmSoldOutReset(soldOutCount)} message={`ล้างสถานะหมดสำหรับ ${soldOutCount} รายการหรือไม่? สินค้าที่ปิดใช้งานจะยังปิดใช้งานอยู่`} confirmLabel="ล้างสถานะหมด">
        <Button type="submit" variant="outline" disabled={soldOutCount === 0}>ล้างสถานะหมด</Button>
        <span className="text-sm text-muted-foreground">หมดชั่วคราว {soldOutCount} รายการ · เริ่มวันใหม่ด้วยการล้างสถานะหมด</span>
        {soldOutState.message ? <span role="status" className="basis-full text-sm text-muted-foreground">{soldOutState.message}</span> : null}
      </ConfirmSubmit>
      <ConfirmSubmit action={action} className="space-y-4" shouldConfirm={(form) => shouldConfirmBulkAction(new FormData(form).getAll("productIds").length)} message={(form, submitter) => {
        const count = new FormData(form).getAll("productIds").length;
        if (submitter?.name === "restoreForSale") {
          const hiddenNote = selectionVisibility.hidden > 0 ? ` โดยมี ${selectionVisibility.hidden} รายการซ่อนจากตัวกรอง` : "";
          return `เปิดขายสินค้า ${count} รายการและล้างสถานะหมด${hiddenNote}หรือไม่?`;
        }
        const actionLabel = submitter?.value === "true" ? "แสดง" : "ซ่อน";
        const location = submitter?.value === "true" ? "บนหน้าขาย" : "จากหน้าขาย";
        const hiddenNote = selectionVisibility.hidden > 0 ? ` โดยมี ${selectionVisibility.hidden} รายการซ่อนจากตัวกรอง` : "";
        return `${actionLabel}สินค้า ${count} รายการ${location}${hiddenNote}หรือไม่?`;
      }} confirmLabel={(submitter) => submitter?.name === "restoreForSale" ? "เปิดขาย" : submitter?.value === "true" ? "แสดง" : "ซ่อน"}>
      {validSelectedIds.filter((id) => !filteredIds.has(id)).map((id) => <input key={id} type="hidden" name="productIds" value={id} />)}
      <div className="space-y-4">
        <ProductFilters products={products} categories={categories} search={search} setSearch={setSearch} category={category} setCategory={setCategory} status={status} setStatus={setStatus} />
      </div>
      <div className="sticky top-[17rem] z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur md:top-2">
        <span className="mr-auto text-sm text-muted-foreground">พบ {filtered.length} จาก {products.length} รายการ · เลือกแล้ว {selectionVisibility.visible} รายการที่แสดง · ซ่อน {selectionVisibility.hidden}</span>
        {validSelectedIds.length > 0 && <Button type="button" variant="ghost" onClick={() => setSelectedIds([])}>ล้างที่เลือก</Button>}
        <Button type="submit" name="isActive" value="true" variant="outline" disabled={validSelectedIds.length === 0}>แสดงบนหน้าขาย</Button>
        <Button type="submit" name="restoreForSale" value="true" disabled={validSelectedIds.length === 0}>เปิดขายที่เลือก</Button>
        <Button type="submit" name="isActive" value="false" variant="outline" disabled={validSelectedIds.length === 0}>ซ่อนจากหน้าขาย</Button>
        <p className="basis-full text-sm" role="status" aria-live="polite">{state.message}</p>
      </div>
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader><CardTitle>{group.name}</CardTitle></CardHeader>
          <CardContent>
              <ul className="divide-y">
                {group.products.map((product) => (
                  <li key={product.id} className="grid grid-cols-[auto_3rem_minmax(0,1fr)] items-center gap-2 py-3 sm:gap-3">
                    <Checkbox name="productIds" value={product.id} checked={selectedSet.has(product.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? getValidSelectedProductIds([...current, product.id], products.map((item) => item.id)) : current.filter((id) => id !== product.id))} aria-label={`เลือก ${product.name}`} className="size-5 after:-inset-3" />
                    {product.imageUrl ? <Image src={product.imageUrl} alt="" width={48} height={48} className="size-12 rounded-md object-cover" /> : <div className="size-12 rounded-md bg-muted" aria-hidden="true" />}
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="line-clamp-2 min-w-0 font-medium">{product.name}</span>
                          <span className="whitespace-nowrap text-sm font-semibold">{formatBaht(product.basePriceSatang)}</span>
                        </div>
                        <div className="flex max-w-full flex-wrap gap-1">
                          <Badge variant={product.earnsStamp ? "secondary" : "outline"}>{product.earnsStamp ? "ได้แสตมป์" : "ไม่มีแสตมป์"}</Badge>
                          <Badge variant={product.isActive ? "default" : "outline"}>{product.isActive ? "แสดงบนหน้าขาย" : "ซ่อนจากหน้าขาย"}</Badge>
                          {product.soldOut ? <Badge variant="destructive">หมดชั่วคราว</Badge> : null}
                        </div>
                      </div>
                      <ProductEditLink href={`/admin/menu/${product.id}`} />
                    </div>
                  </li>
                ))}
              </ul>
          </CardContent>
        </Card>
      ))}
      </ConfirmSubmit>
    </div>
  );
}

function ProductFilters({
  products,
  categories,
  search,
  setSearch,
  category,
  setCategory,
  status,
  setStatus,
}: {
  products: Product[];
  categories: Category[];
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
}) {
  const searchId = useId();
  return <Card><CardContent className="space-y-3 p-4">
    <div className="space-y-2">
      <Label htmlFor={searchId}>ค้นหาเมนู</Label>
      <Input id={searchId} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="พิมพ์ชื่อสินค้า" />
    </div>
    <fieldset className="min-w-0 space-y-1">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">กรองตามหมวดหมู่</legend>
      <div className="flex gap-2 overflow-x-auto pb-1">
      {[{ id: "all", name: "ทั้งหมด" }, ...categories.map(({ id, name }) => ({ id, name })), { id: "none", name: "ไม่มีหมวดหมู่" }].map((item) => (
        <Button key={item.id} type="button" size="sm" variant={category === item.id ? "default" : "outline"} className="shrink-0" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
          {item.name}{" "}<span className="opacity-75">{products.filter((product) => item.id === "all" || (item.id === "none" ? product.categoryId === null : product.categoryId === item.id)).length}</span>
        </Button>
      ))}
      </div>
    </fieldset>
    <fieldset className="min-w-0 space-y-1">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">กรองตามสถานะสินค้า</legend>
      <div className="flex flex-wrap gap-2">
      {[{ id: "all", name: "ทุกสถานะ" }, { id: "active", name: "แสดงบนหน้าขาย" }, { id: "inactive", name: "ซ่อนจากหน้าขาย" }, { id: "soldOut", name: "หมดชั่วคราว" }].map((item) => (
        <Button key={item.id} type="button" size="sm" variant={status === item.id ? "secondary" : "ghost"} aria-pressed={status === item.id} onClick={() => setStatus(item.id)}>{item.name}</Button>
      ))}
      </div>
    </fieldset>
  </CardContent></Card>;
}

export function PosMenuPreview({ products }: { products: Product[] }) {
  const grouped = new Map<string, Product[]>();
  for (const product of products) {
    const category = product.categoryName ?? "อื่น ๆ";
    grouped.set(category, [...(grouped.get(category) ?? []), product]);
  }
  const categories = [...grouped.keys()];
  return (
    <Card>
      <CardHeader><p className="text-sm text-muted-foreground">ตัวอย่างสินค้าที่จะแสดงให้พนักงานเลือกบนหน้าขาย</p></CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <nav aria-label="หมวดหมู่ในตัวอย่าง POS" className="flex gap-2 overflow-x-auto lg:flex-col">
          {categories.length ? categories.map((category, index) => <Badge key={category} variant={index === 0 ? "default" : "outline"} className="w-fit shrink-0 px-3 py-2">{category}</Badge>) : <span className="text-sm text-muted-foreground">ยังไม่มีสินค้าเปิดขาย</span>}
        </nav>
        <div className="space-y-5">
          {[...grouped.entries()].map(([category, items]) => <section key={category} aria-label={`ตัวอย่างหมวดหมู่ ${category}`} className="space-y-2">
            <h3 className="text-sm font-semibold">{category}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => <div key={product.id} className="overflow-hidden rounded-xl border bg-card">
                {product.imageUrl ? <Image src={product.imageUrl} alt="" width={240} height={140} className="h-28 w-full object-cover" /> : <div className="h-28 bg-muted" aria-hidden="true" />}
                <div className="p-3"><p className="line-clamp-2 text-sm font-medium">{product.name}</p><p className="mt-1 text-sm text-muted-foreground">{formatBaht(product.basePriceSatang)}</p></div>
              </div>)}
            </div>
          </section>)}
          {products.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">เปิดขายสินค้าเพื่อให้แสดงบน POS</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
