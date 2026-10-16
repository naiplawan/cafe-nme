import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { getMenuSettings, listCategories, listModifierGroupsForShop, listProducts } from "@/server/menu";
import { AdminPageHeader } from "../_components/page-header";
import { createProductAction } from "./actions";
import { CategoryManager, ImportStockMenu, OpenProductSectionButton, ProductForm } from "./forms";
import { menuHref, parseMenuStep, parseProductFilters } from "./menu-steps";
import { MenuProductList, PosMenuPreview } from "./product-list";
import { MenuStepNav } from "./step-nav";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ shopId }, query] = await Promise.all([requireStaff(), searchParams]);
  const [categories, products, modifierGroups, settings] = await Promise.all([
    listCategories(shopId),
    listProducts(shopId),
    listModifierGroupsForShop(shopId),
    getMenuSettings(shopId),
  ]);
  const step = parseMenuStep(query.step, categories.length);
  const filters = parseProductFilters(query);
  const activeProducts = products.filter((product) => product.isActive);
  const steps = [
    { step: "categories" as const, label: "หมวดหมู่", count: categories.length },
    { step: "products" as const, label: "สินค้า", count: products.length },
    { step: "preview" as const, label: "ตัวอย่างหน้าขาย", count: activeProducts.length },
  ];
  const addHref = `${menuHref("products", filters)}&add=1`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="เมนู"
        action={step === "products" ? <OpenProductSectionButton /> : <Link href={addHref} className={buttonVariants()}>เพิ่มสินค้า</Link>}
      />
      <MenuStepNav steps={steps} current={step} filters={filters} />

      {step === "categories" ? (
        <section aria-label="หมวดหมู่">
          <CategoryManager categories={categories} />
        </section>
      ) : null}

      {step === "products" ? (
        <>
          <section className="space-y-4" aria-label="เพิ่มและนำเข้าสินค้า">
            <details className="group rounded-xl border bg-card" data-add-product-section open={query.add === "1" || undefined}>
              <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold marker:hidden">เพิ่มสินค้า <span className="float-right text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></summary>
              <div className="border-t px-4 pt-4 sm:px-5 sm:pt-5"><ProductForm categories={categories} modifierGroups={modifierGroups} action={createProductAction} submitLabel="เพิ่มสินค้า" /></div>
            </details>
            <ImportStockMenu products={products} />
          </section>

          <section aria-label="สินค้า">
            <MenuProductList products={products} categories={categories} initialFilters={filters} modifierGroups={modifierGroups} autoClearSoldOut={settings.autoClearSoldOut} />
          </section>
        </>
      ) : null}

      {step === "preview" ? (
        <section aria-label="ตัวอย่างเมนูบนหน้าขาย">
          <PosMenuPreview products={activeProducts} />
        </section>
      ) : null}
    </div>
  );
}
