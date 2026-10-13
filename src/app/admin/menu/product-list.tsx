"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBaht } from "@/lib/money";
import { bulkUpdateProductsAction } from "./actions";
import { clearSoldOutProductsAction } from "./actions";

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
  const filtered = useMemo(() => products.filter((product) =>
    product.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (category === "all" || (category === "none" ? product.categoryId === null : product.categoryId === category)) &&
    (status === "all" || (status === "soldOut" ? product.soldOut : status === "active" ? product.isActive : !product.isActive)),
  ), [products, search, category, status]);
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
      <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">ไม่พบสินค้าตามตัวกรอง</CardContent></Card>
    </div>;
  }

  return (
    <div className="space-y-4">
      <form action={clearSoldOut} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <Button type="submit" variant="outline" disabled={!products.some((product) => product.soldOut)}>มีขายทั้งหมด</Button>
        <span className="text-sm text-muted-foreground">เริ่มวันใหม่ด้วยการเปิดขายเมนูที่หมดไว้ทั้งหมด</span>
        {soldOutState.message ? <span role="status" className="basis-full text-sm text-muted-foreground">{soldOutState.message}</span> : null}
      </form>
      <ConfirmSubmit action={action} className="space-y-4" shouldConfirm={(form, submitter) => submitter?.value === "false" && new FormData(form).getAll("productIds").length > 0} message={(form) => `ปิดขายสินค้าที่เลือก ${new FormData(form).getAll("productIds").length} รายการหรือไม่?`} confirmLabel="ปิดขาย">
      <div className="space-y-4">
        <ProductFilters products={products} categories={categories} search={search} setSearch={setSearch} category={category} setCategory={setCategory} status={status} setStatus={setStatus} />
      </div>
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <span className="mr-auto text-sm text-muted-foreground">พบ {filtered.length} จาก {products.length} รายการ · เลือกเพื่อปรับสถานะ</span>
        <Button type="submit" name="isActive" value="true" variant="outline">เปิดขายที่เลือก</Button>
        <Button type="submit" name="isActive" value="false" variant="outline">ปิดขายที่เลือก</Button>
        <p className="basis-full text-sm" role="status" aria-live="polite">{state.message}</p>
      </div>
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader><CardTitle>{group.name}</CardTitle></CardHeader>
          <CardContent>
              <ul className="divide-y">
                {group.products.map((product) => (
                  <li key={product.id} className="grid grid-cols-[auto_3rem_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:gap-3">
                    <Checkbox name="productIds" value={product.id} aria-label={`เลือก ${product.name}`} />
                    {product.imageUrl ? <Image src={product.imageUrl} alt="" width={48} height={48} className="size-12 rounded-md object-cover" /> : <div className="size-12 rounded-md bg-muted" aria-hidden="true" />}
                    <span className="min-w-0 truncate font-medium" title={product.name}>{product.name}</span>
                    <div className="flex min-w-0 flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-sm font-semibold">{formatBaht(product.basePriceSatang)}</span>
                      <div className="flex max-w-full flex-wrap justify-end gap-1">
                        <Badge variant={product.earnsStamp ? "secondary" : "outline"}>{product.earnsStamp ? "ได้แสตมป์" : "ไม่มีแสตมป์"}</Badge>
                        <Badge variant={product.isActive ? "default" : "outline"}>{product.isActive ? "เปิดขาย" : "ปิดขาย"}</Badge>
                        {product.soldOut ? <Badge variant="destructive">หมด</Badge> : null}
                      </div>
                      <Button variant="outline" size="sm" render={<Link href={`/admin/menu/${product.id}`} />}>แก้ไข</Button>
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
  return <Card><CardContent className="space-y-3 p-4">
    <div className="space-y-2">
      <Label htmlFor="menu-list-search">ค้นหาเมนู</Label>
      <Input id="menu-list-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="พิมพ์ชื่อสินค้า" />
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="กรองตามหมวดหมู่">
      {[{ id: "all", name: "ทั้งหมด" }, ...categories.map(({ id, name }) => ({ id, name })), { id: "none", name: "ไม่มีหมวดหมู่" }].map((item) => (
        <Button key={item.id} type="button" size="sm" variant={category === item.id ? "default" : "outline"} className="shrink-0" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
          {item.name}{" "}<span className="opacity-75">{products.filter((product) => item.id === "all" || (item.id === "none" ? product.categoryId === null : product.categoryId === item.id)).length}</span>
        </Button>
      ))}
    </div>
    <div className="flex gap-2" aria-label="กรองตามสถานะสินค้า">
      {[{ id: "all", name: "ทุกสถานะ" }, { id: "active", name: "เปิดขาย" }, { id: "inactive", name: "ปิดขาย" }, { id: "soldOut", name: "หมด" }].map((item) => (
        <Button key={item.id} type="button" size="sm" variant={status === item.id ? "secondary" : "ghost"} aria-pressed={status === item.id} onClick={() => setStatus(item.id)}>{item.name}</Button>
      ))}
    </div>
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
      <CardHeader><CardTitle>ตัวอย่างเมนูบน POS</CardTitle><p className="text-sm text-muted-foreground">แสดงสินค้าเปิดขายที่บันทึกแล้ว พนักงานจะเห็นเมนูนี้บนหน้าขาย</p></CardHeader>
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
