import { formatBaht } from "@/lib/money";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getStockPolicy, listInventory } from "@/server/inventory";
import { getSubscription } from "@/server/subscriptions";
import { AdminPageHeader } from "../_components/page-header";
import { CreateIngredientForm, RecipeEditor, StockMovementForm, StockPolicyForm, StockValuationForm, ThresholdForm } from "./forms";

const formatQuantity = (milliunits: number) => (milliunits / 1000).toLocaleString("th-TH", { maximumFractionDigits: 3 });
const movementLabels = { receive: "รับเข้า", waste: "ของเสีย", adjust: "ปรับยอด", sale: "ใช้ตามสูตร", remake: "ทำใหม่" };

export default async function InventoryPage() {
  const session = await requireStaff();
  const [inventory, subscription, stockPolicy] = await Promise.all([
    listInventory(session.shopId, session.staff.id),
    getSubscription(session.shopId, session.staff.id, session.userId),
    getStockPolicy(session.shopId, session.staff.id),
  ]);
  const hasPro = subscription.allowedFeatures.includes("inventory-write");
  const canManage = session.staff.role === "owner" || session.staff.role === "manager";
  const canEdit = hasPro && canManage;
  const low = inventory.ingredients.filter((ingredient) => ingredient.lowStock);
  return <div className="space-y-6">
    <AdminPageHeader section="วัตถุดิบ" title="สต็อกและสูตร" description="รับเข้า บันทึกของเสีย และตัดวัตถุดิบตามสูตรเมื่อขาย" />
    <div role="status" className="rounded-xl border bg-card p-4">
      {low.length ? <><p className="font-semibold text-amber-800">วัตถุดิบถึงจุดเตือน {low.length} รายการ</p><p>{low.map((ingredient) => ingredient.name).join(" · ")}</p></> : <p>ไม่มีวัตถุดิบถึงจุดเตือน</p>}
      <p className="mt-2 text-sm text-muted-foreground">คืนเงินก่อนเริ่มทำในโหมดเตรียมเครื่องดื่มจะปล่อยยอดจอง การคืนเงินหลังตัดวัตถุดิบจะไม่เติมสต็อกกลับอัตโนมัติ หากคืนวัตถุดิบจริง ให้ผู้จัดการบันทึกปรับยอดพร้อมเหตุผล</p>
    </div>
    {!hasPro ? <p className="rounded-xl border bg-card p-4">เปิดดูสต็อกเดิมและรับวัตถุดิบเข้าได้ การบันทึกของเสีย ปรับยอด เพิ่มวัตถุดิบ และแก้สูตรต้องใช้ Pro หรือช่วงทดลอง · <Link href="/admin/subscription" className="underline">ดูแพ็กเกจร้าน</Link></p> : null}
    {canEdit ? <><StockPolicyForm mode={stockPolicy.mode} /><CreateIngredientForm /></> : null}
    <section aria-label="วัตถุดิบคงเหลือ" className="grid gap-4 lg:grid-cols-2">
      {inventory.ingredients.map((ingredient) => <article key={ingredient.id} className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{ingredient.name}</h2>
        <p className={`mt-1 text-xl font-bold ${ingredient.lowStock ? "text-amber-800" : ""}`}>{formatQuantity(ingredient.onHandMilliunits)} {ingredient.unit}</p>
        <p className="text-sm">จองแล้ว {formatQuantity(ingredient.reservedMilliunits ?? 0)} · พร้อมใช้ {formatQuantity(ingredient.availableMilliunits ?? ingredient.onHandMilliunits)} {ingredient.unit}</p>
        <p className="text-sm text-muted-foreground">จุดเตือน {formatQuantity(ingredient.lowStockMilliunits)} {ingredient.unit}{ingredient.onHandMilliunits < 0 ? " · ยอดติดลบ กรุณาตรวจนับ" : ""}</p>
        {canManage ? <details className="mt-3"><summary className="cursor-pointer py-2 font-medium">{hasPro ? "รับเข้า / ของเสีย / ปรับยอด" : "รับวัตถุดิบเข้า"}</summary>
          <StockMovementForm ingredient={ingredient} requestId={randomUUID()} receiveOnly={!hasPro} />
          {canEdit ? <><ThresholdForm ingredient={ingredient} />{ingredient.onHandMilliunits > 0 ? <StockValuationForm ingredient={ingredient} requestId={randomUUID()} /> : null}</> : null}
        </details> : null}
      </article>)}
      {inventory.ingredients.length === 0 ? <p>ยังไม่มีวัตถุดิบ เริ่มจากเพิ่มวัตถุดิบและหน่วยหลัก</p> : null}
    </section>
    {canEdit ? <RecipeEditor inventory={inventory} /> : null}
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">การเคลื่อนไหวล่าสุด (100 รายการ)</h2>
      <div className="mt-3 divide-y">
        {inventory.movements.map((movement) => {
          const ingredient = inventory.ingredients.find((item) => item.id === movement.ingredientId);
          return <article key={movement.id} className="py-3">
            <p className="font-medium">{ingredient?.name} · {movementLabels[movement.kind]} · {formatQuantity(movement.quantityMilliunits)} {ingredient?.unit}</p>
            <p className="text-sm">{movement.kind === "sale" ? "ตัดตามสูตรที่ใช้ขณะขาย" : movement.reason}</p>
            <p className="text-sm">ต้นทุน {movement.costSatang == null ? "ยังไม่ทราบ" : formatBaht(movement.costSatang)}</p>
            <p className="text-xs text-muted-foreground">{new Date(movement.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          </article>;
        })}
        {inventory.movements.length === 0 ? <p>ยังไม่มีการเคลื่อนไหว</p> : null}
      </div>
    </section>
  </div>;
}
