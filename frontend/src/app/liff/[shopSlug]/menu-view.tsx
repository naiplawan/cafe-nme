"use client";

import Image from "next/image";
import { useRef } from "react";
import { BrandLogo } from "@/components/brand/brand";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { brandVars } from "@/lib/brand";
import type { CSSProperties } from "react";

export type LiffMenuCategory = {
  id: string;
  name: string;
  products: { id: string; name: string; priceSatang: number; soldOut: boolean; imageUrl: string | null }[];
};

export function MenuView({ shopName, brand, categories, onShowCard }: {
  shopName: string;
  brand: { accent: string; custom: boolean; logoUrl: string | null };
  categories: LiffMenuCategory[];
  onShowCard: () => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion() || !rootRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const cards = rootRef.current?.querySelectorAll("[data-menu-card]");
      if (cards?.length) gsap.fromTo(cards, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: rootRef });

  function scrollToCategory(id: string) {
    document.getElementById(`menu-category-${id}`)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  return <main ref={rootRef} style={brandVars(brand.accent) as CSSProperties} className="mx-auto min-h-screen max-w-md pb-24">
    <header className="flex items-center gap-3 px-4 py-5">
      <BrandLogo logoUrl={brand.logoUrl} size={44} />
      <div><p className="text-sm text-muted-foreground">เมนูของร้าน</p><h1 className="text-lg font-semibold">{shopName}</h1></div>
    </header>
    {categories.length ? <>
      <nav aria-label="หมวดหมู่เมนู" className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-y bg-background/95 px-4 py-3 backdrop-blur">
        {categories.map((category) => <button key={category.id} type="button" onClick={() => scrollToCategory(category.id)} className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{category.name}</button>)}
      </nav>
      <div className="space-y-7 px-4 py-5">
        {categories.map((category) => <section key={category.id} id={`menu-category-${category.id}`} className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-semibold">{category.name}</h2>
          <div className="grid grid-cols-2 gap-3">
            {category.products.map((product) => <article data-menu-card key={product.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="relative aspect-square bg-muted">
                {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 448px) 45vw, 200px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ไม่มีรูปภาพ</div>}
              </div>
              <div className="space-y-1 p-3">{product.soldOut && <p className="text-sm font-semibold text-destructive">หมดชั่วคราว</p>}<h3 className="line-clamp-2 min-h-10 font-medium">{product.name}</h3><p className="font-semibold text-primary">฿{(product.priceSatang / 100).toLocaleString("th-TH")}</p></div>
            </article>)}
          </div>
        </section>)}
      </div>
    </> : <p className="px-4 py-10 text-center text-muted-foreground">ยังไม่มีเมนู</p>}
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
      <button type="button" onClick={onShowCard} className={`w-full rounded-xl px-4 py-3 font-semibold ${brand.custom ? "bg-[var(--brand)] text-[var(--brand-fg)]" : "bg-primary text-primary-foreground"}`}>ดูบัตรสมาชิก</button>
    </div>
  </main>;
}
