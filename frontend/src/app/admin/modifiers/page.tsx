import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatBaht } from "@/lib/money";
import { getModifierProducts } from "@/server/admin-data";
import { listModifierGroups } from "@/server/modifiers";
import { AdminPageHeader } from "../_components/page-header";
import {
  createModifierAction,
  createModifierGroupAction,
  deleteModifierAction,
  deleteModifierGroupAction,
  updateModifierGroupAction,
} from "./actions";
import {
  AddModifierForm,
  DeleteGroupForm,
  DeleteModifierForm,
  ModifierGroupForm,
  GroupProductsForm,
  StandardModifierPresetForm,
} from "./modifier-forms";

function ruleText(minSelect: number, maxSelect: number) {
  if (minSelect > 0 && maxSelect > minSelect) return `ต้องเลือกอย่างน้อย ${minSelect} และเลือกได้ไม่เกิน ${maxSelect}`;
  if (minSelect > 0) return `ต้องเลือก ${minSelect}`;
  if (maxSelect > 1) return `เลือกได้ไม่เกิน ${maxSelect}`;
  return "ไม่บังคับ";
}

function deltaText(satang: number) {
  if (satang === 0) return "ฟรี";
  return satang > 0 ? `+${formatBaht(satang)}` : formatBaht(satang);
}

function selectedRule(minSelect: number, maxSelect: number) {
  return ruleText(minSelect, maxSelect);
}

function SetupFlow() {
  const steps = ["ตั้งกติกา", "เพิ่มตัวเลือก", "ผูกกับเมนู"];
  return <section aria-label="ขั้นตอนตั้งค่าตัวเลือกเสริม" className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
    {steps.map((step, index) => <div key={step} className="contents">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
        <span className="text-sm font-medium">{step}</span>
      </div>
      {index < steps.length - 1 && <ArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" />}
    </div>)}
  </section>;
}

export default async function ModifiersPage() {
  const newGroupId = "new-modifier-group";
  const { shopId } = await requireStaff();
  const [groups, productRows] = await Promise.all([
    listModifierGroups(shopId),
    getModifierProducts(shopId),
  ]);
  const productsByCategory = productRows.reduce<{ id: string; name: string; products: { id: string; name: string }[] }[]>((result, product) => {
    const categoryId = product.categoryId ?? "uncategorized";
    let category = result.find((item) => item.id === categoryId);
    if (!category) {
      category = { id: categoryId, name: product.categoryName ?? "ยังไม่จัดหมวดหมู่", products: [] };
      result.push(category);
    }
    category.products.push({ id: product.id, name: product.name });
    return result;
  }, []);

  return (
    <div className="space-y-7">
      <AdminPageHeader section="สินค้า" title="ตัวเลือกเสริม" description="กำหนดสิ่งที่พนักงานเลือกเพิ่มตอนรับออเดอร์ เช่น ความหวาน ขนาดแก้ว หรือนม" action={<Link href={`#${newGroupId}`} className={buttonVariants()}><Plus aria-hidden="true" />เพิ่มกลุ่มตัวเลือก</Link>} />

      <SetupFlow />

      <section id={newGroupId} className="scroll-mt-6">
        <Card className="border-primary/20 bg-primary/[0.025]">
          <CardHeader className="pb-2">
            <CardTitle>สร้างกลุ่มใหม่</CardTitle>
            <p className="text-sm text-muted-foreground">สร้างกติกาก่อน แล้วค่อยเพิ่มตัวเลือกในกลุ่ม เช่น “ความหวาน” มี 0%, 50% และ 100%</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ModifierGroupForm action={createModifierGroupAction} />
            <StandardModifierPresetForm />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-label="กลุ่มตัวเลือกเสริม">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-semibold">กลุ่มตัวเลือก</h2><p className="mt-1 text-sm text-muted-foreground">กลุ่มจะแสดงบน POS เมื่อเชื่อมกับสินค้า</p></div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{groups.length} กลุ่ม</Badge>
            <Badge variant="outline">{groups.reduce((total, group) => total + group.modifiers.length, 0)} ตัวเลือก</Badge>
          </div>
        </div>
        {groups.length === 0 ? (
          <Card>
            <CardContent className="px-6 py-10 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true"><SlidersHorizontal className="size-5" /></span>
              <h3 className="mt-2 font-semibold">เริ่มจากสร้างกลุ่มตัวเลือก</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">ตัวอย่างเช่น ความหวานหรือชนิดนม จากนั้นเพิ่มตัวเลือกและผูกกลุ่มกับสินค้า</p>
              <Link href={`#${newGroupId}`} className={buttonVariants({ className: "mt-4" })}>สร้างกลุ่มแรก</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group.id} className="overflow-hidden">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 space-y-3">
                      <span className="block">
                        <span className="block truncate text-base font-semibold">{group.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span>{selectedRule(group.minSelect, group.maxSelect)}</span><span aria-hidden="true">·</span>
                          <span>{group.modifiers.length} ตัวเลือก</span><span aria-hidden="true">·</span>
                          <span>{group.productNames.length ? `ใช้กับ ${group.productNames.length} เมนู` : "ยังไม่ใช้กับเมนู"}</span>
                        </span>
                      </span>
                      <span aria-hidden="true" className="block rounded-lg bg-muted/40 p-3">
                        <span className="mb-2 block text-xs font-medium text-muted-foreground">ตัวอย่างตัวเลือกบนหน้าขาย</span>
                        {group.modifiers.length ? <span className="flex flex-wrap gap-2">
                          {group.modifiers.slice(0, 5).map((modifier) => <span key={modifier.id} className="inline-flex min-h-9 items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm shadow-sm">
                            <span className="size-3.5 shrink-0 rounded-full border-2 border-muted-foreground/60" />
                            <span className="max-w-36 truncate font-medium">{modifier.name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{deltaText(modifier.priceDeltaSatang)}</span>
                          </span>)}
                          {group.modifiers.length > 5 && <span className="inline-flex min-h-9 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">+{group.modifiers.length - 5} ตัวเลือก</span>}
                        </span> : <span className="text-sm text-muted-foreground">ยังไม่มีตัวเลือก · เปิดเพื่อเพิ่มตัวเลือกแรก</span>}
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-5 border-t px-5 py-5">
                    <GroupProductsForm groupId={group.id} selectedProductIds={group.productIds} productsByCategory={productsByCategory} />
                    <section className="space-y-3" aria-label={`กติกาของ ${group.name}`}>
                      <div><h3 className="font-semibold">กติกาการเลือก</h3><p className="text-sm text-muted-foreground">{ruleText(group.minSelect, group.maxSelect)} · ลูกค้าจะเห็นกติกานี้ในหน้าขาย</p></div>
                      <ModifierGroupForm action={updateModifierGroupAction} group={group} />
                    </section>
                    <section className="space-y-3" aria-label={`ตัวเลือกใน ${group.name}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">ตัวเลือก</h3><div className="flex items-center gap-2"><Badge variant="secondary">{group.modifiers.length}</Badge>{group.minSelect > 0 && group.modifiers.length === 0 && <Badge variant="destructive">ยังไม่มีตัวเลือก — สินค้าที่ใช้กลุ่มนี้จะเลือกไม่ได้</Badge>}</div></div>
                      {group.modifiers.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">ยังไม่มีตัวเลือก เพิ่มตัวเลือกแรกด้านล่าง</p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {group.modifiers.map((modifier) => (
                            <li key={modifier.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                              <span className="min-w-0 truncate font-medium">{modifier.name}</span>
                              <span className="flex shrink-0 items-center gap-3"><span className="text-sm tabular-nums text-muted-foreground">{deltaText(modifier.priceDeltaSatang)}</span><DeleteModifierForm action={deleteModifierAction} modifierId={modifier.id} name={modifier.name} /></span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="rounded-lg border bg-muted/20 p-4"><h4 className="mb-3 text-sm font-semibold">เพิ่มตัวเลือก</h4><AddModifierForm action={createModifierAction} groupId={group.id} /></div>
                    </section>
                    <div className="flex justify-end border-t pt-4"><DeleteGroupForm action={deleteModifierGroupAction} groupId={group.id} name={group.name} productCount={group.productNames.length} /></div>
                  </div>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
