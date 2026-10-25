import "server-only";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { z } from "zod";
import { BrandLogo } from "@/components/brand/brand";
import { brandVars } from "@/lib/brand";
import { getBrand } from "@/server/brand";
import { getPosMenu } from "@/server/catalog";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";

export const instant = false;
// Public QR menus opt back into search; the root layout keeps app screens noindex.
export const metadata: Metadata = { robots: { index: true, follow: true } };
const SHOP_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i;
const shopSchema = z.object({ shopId: z.uuid(), name: z.string() }).nullable();

export default async function PublicMenuPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  await connection();
  const { shopSlug } = await params;
  if (!SHOP_SLUG.test(shopSlug)) { notFound(); }
  const response = await internalApiFetch(`/v1/liff/shops/${encodeURIComponent(shopSlug)}`);
  if (!response.ok) { throw new Error(`Menu shop API returned ${response.status}`); }
  const shop = shopSchema.parse(await readInternalJson(response));
  if (!shop) { notFound(); }
  const [menu, brand] = await Promise.all([getPosMenu(shop.shopId), getBrand(shop.shopId)]);
  const categories = [...menu.categories, { id: "uncategorized", name: "อื่นๆ" }].map((category) => ({
    ...category,
    products: menu.products.filter((product) => (product.categoryId ?? "uncategorized") === category.id),
  })).filter((category) => category.products.length > 0);

  return <main style={brandVars(brand.accent) as CSSProperties} className="mx-auto min-h-screen w-full max-w-md pb-24">
    <header className="flex items-center gap-3 px-4 py-5">
      <BrandLogo logoUrl={brand.logoUrl} size={44} />
      <div><p className="text-sm text-muted-foreground">เมนูของร้าน</p><h1 className="text-lg font-semibold">{shop.name}</h1></div>
    </header>
    {categories.length > 0 ? <>
      <nav aria-label="หมวดหมู่เมนู" className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-y bg-background px-4 py-3">
        {categories.map((category) => <a key={category.id} href={`#menu-${category.id}`} className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium">{category.name}</a>)}
      </nav>
      <div className="space-y-7 px-4 py-5">
        {categories.map((category) => <section key={category.id} id={`menu-${category.id}`} className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-semibold">{category.name}</h2>
          <div className="grid grid-cols-2 gap-3">
            {category.products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              {product.imageUrl ? <div className="relative aspect-square bg-muted"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 448px) 45vw, 200px" className="object-cover" /></div> : null}
              <div className="space-y-1 p-3">
                {product.soldOut ? <p className="text-sm font-semibold text-destructive">หมดชั่วคราว</p> : null}
                <h3 className="font-medium">{product.name}</h3>
                <p className="font-semibold">฿{(product.basePriceSatang / 100).toLocaleString("th-TH")}</p>
              </div>
            </article>)}
          </div>
        </section>)}
      </div>
    </> : <p className="px-4 py-10 text-center text-muted-foreground">ยังไม่มีเมนู</p>}
    <footer className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <a href={`/menu/${encodeURIComponent(shopSlug)}/order`} className="mb-2 block rounded-xl border px-4 py-3 text-center font-semibold">สั่งเครื่องดื่ม</a>
      <a href={`/liff/${encodeURIComponent(shopSlug)}`} className="block rounded-xl bg-[var(--brand)] px-4 py-3 text-center font-semibold text-[var(--brand-fg)]">ดูบัตรสมาชิก / สมัครผ่าน LINE</a>
    </footer>
  </main>;
}
