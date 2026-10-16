import { requireStaff } from "@/lib/auth";
import { listCategories, listModifierGroupsForShop, listProducts } from "@/server/menu";
import { AdminPageHeader } from "../_components/page-header";
import { createProductAction } from "./actions";
import { CategoryManager, ImportStockMenu, OpenProductSectionButton, ProductForm } from "./forms";
import { MenuProductList, PosMenuPreview } from "./product-list";

export default async function MenuPage() {
  const { shopId } = await requireStaff();
  const [categories, products, modifierGroups] = await Promise.all([
    listCategories(shopId),
    listProducts(shopId),
    listModifierGroupsForShop(shopId),
  ]);
  return (
    <div className="space-y-8">
      <AdminPageHeader section="สินค้า" title="เมนู" description="จัดการสินค้า หมวดหมู่ ราคา และสถานะการขาย" action={<OpenProductSectionButton />} />

      <section className="space-y-4" aria-label="เพิ่มและนำเข้าสินค้า">
        <details className="group rounded-xl border bg-card" data-add-product-section>
          <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold marker:hidden">เพิ่มสินค้า <span className="float-right text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></summary>
          <div className="border-t p-4 sm:p-5"><ProductForm categories={categories} modifierGroups={modifierGroups} action={createProductAction} submitLabel="เพิ่มสินค้า" /></div>
        </details>
        <ImportStockMenu products={products} />
      </section>

      <section className="space-y-4" aria-label="สินค้า">
        <div><h2 className="text-xl font-semibold">สินค้า</h2></div>
        <MenuProductList
          products={products}
          categories={categories}
        />
      </section>

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold marker:hidden">ตัวอย่างเมนูบนหน้าขาย <span className="float-right text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></summary>
        <div className="border-t p-4 sm:p-5"><PosMenuPreview products={products.filter((product) => product.isActive)} /></div>
      </details>

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold marker:hidden">จัดการหมวดหมู่ <span className="float-right text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></summary>
        <div className="border-t p-4 sm:p-5"><CategoryManager categories={categories} /></div>
      </details>
    </div>
  );
}
