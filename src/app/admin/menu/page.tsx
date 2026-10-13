import { requireStaff } from "@/lib/auth";
import { listCategories, listProducts } from "@/server/menu";
import { CategoryManager, ImportStockMenu, OpenProductSectionButton, ProductForm } from "./forms";
import { createProductAction } from "./actions";
import { AdminPageHeader } from "../_components/page-header";
import { MenuProductList, PosMenuPreview } from "./product-list";

export default async function MenuPage() {
  const { shopId } = await requireStaff();
  const [categories, products] = await Promise.all([
    listCategories(shopId),
    listProducts(shopId),
  ]);
  return (
    <div className="space-y-8">
      <AdminPageHeader section="สินค้า" title="เมนู" description="จัดการสินค้า หมวดหมู่ ราคา และสถานะการขาย" action={<OpenProductSectionButton />} />

      <section className="space-y-4" aria-labelledby="menu-products-heading">
        <div><h2 id="menu-products-heading" className="text-xl font-semibold">สินค้า</h2></div>
        <MenuProductList
          products={products}
          categories={categories}
          emptyStateAction={products.length === 0 ? <ImportStockMenu products={products} emptyState /> : undefined}
        />
      </section>

      {products.length > 0 ? <ImportStockMenu products={products} /> : null}
      <PosMenuPreview products={products.filter((product) => product.isActive)} />

      <details className="group rounded-xl border bg-card" id="add-product">
        <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold marker:hidden">เพิ่มสินค้า <span className="float-right text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></summary>
        <div className="border-t p-4 sm:p-5"><ProductForm categories={categories} action={createProductAction} submitLabel="เพิ่มสินค้า" /></div>
      </details>

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold marker:hidden">จัดการหมวดหมู่ <span className="float-right text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></summary>
        <div className="border-t p-4 sm:p-5"><CategoryManager categories={categories} /></div>
      </details>
    </div>
  );
}
