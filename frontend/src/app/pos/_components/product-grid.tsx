"use client";

import type { PosMenu } from "@/lib/pricing";
import { formatBaht } from "@/lib/money";
import Image from "next/image";
import { ProductTile } from "@/components/product-tile";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";
import { useEffect, useRef } from "react";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleSoldOut } from "@/app/pos/sold-out-actions";

type ProductGridProps = { menu: PosMenu; categoryId: string | null; addedProductId: string | null; onChoose: (productId: string) => void };

export function ProductGrid({ menu, categoryId, addedProductId, onChoose }: ProductGridProps) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [manageSoldOut, setManageSoldOut] = useState(false);
  const [soldOutOverrides, setSoldOutOverrides] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  useEffect(() => () => { if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current); }, []);
  const searchTerm = query.trim().toLocaleLowerCase("th");
  const products = menu.products.filter((product) => searchTerm
    ? product.name.toLocaleLowerCase("th").includes(searchTerm)
    : categoryId === null || product.categoryId === categoryId);
  useGSAP(() => {
    const cards = gsap.utils.toArray<HTMLElement>("[data-product-card]", gridRef.current);
    if (prefersReducedMotion()) gsap.set(cards, { clearProps: "opacity,transform" });
    else gsap.fromTo(cards, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease, clearProps: "transform,opacity" });
  }, { scope: gridRef, dependencies: [categoryId, searchTerm] });

  useGSAP(() => {
    if (!addedProductId || prefersReducedMotion()) return;
    const productId = addedProductId.split(":")[0];
    const source = gridRef.current?.querySelector<HTMLElement>(`[data-product-id="${CSS.escape(productId)}"]`);
    const target = document.querySelector<HTMLElement>("[data-cart-panel]");
    if (!source || !target) return;
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const chip = document.createElement("span");
    chip.textContent = "+1";
    Object.assign(chip.style, { position: "fixed", left: `${from.left + from.width / 2}px`, top: `${from.top + 20}px`, zIndex: "100", pointerEvents: "none" });
    chip.className = "rounded-full bg-[#B4441C] px-3 py-1 text-sm font-bold text-white shadow-lg";
    document.body.append(chip);
    gsap.fromTo(chip, { x: 0, y: 0, opacity: 1, scale: 1 }, { x: to.left - from.left - from.width / 2 + 24, y: to.top - from.top + 24, opacity: 0, scale: 0.72,
      duration: 0.28, ease: MOTION.ease, onComplete: () => chip.remove() });
    window.setTimeout(() => chip.remove(), 450);
  }, { scope: gridRef, dependencies: [addedProductId] });

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2200);
  }

  async function changeSoldOut(productId: string, current: boolean) {
    if (pendingIds.has(productId)) return;
    const next = !current;
    setSoldOutOverrides((overrides) => ({ ...overrides, [productId]: next }));
    setPendingIds((ids) => new Set(ids).add(productId));
    try {
      const result = await toggleSoldOut(productId);
      if (result.ok) {
        setSoldOutOverrides((overrides) => ({ ...overrides, [productId]: result.soldOut }));
        // Refresh server props so the cart (and its sold-out warning) sees the new status too.
        router.refresh();
      } else {
        setSoldOutOverrides((overrides) => ({ ...overrides, [productId]: current }));
        showNotice(result.message);
      }
    } catch {
      setSoldOutOverrides((overrides) => ({ ...overrides, [productId]: current }));
      showNotice("เปลี่ยนสถานะเมนูไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setPendingIds((ids) => { const nextIds = new Set(ids); nextIds.delete(productId); return nextIds; });
    }
  }

  return <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-3">
    <div className="mb-3 flex shrink-0 gap-2">
      <label className="relative min-w-0 flex-1">
        <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A6A4F]" />
        <input type="search" aria-label="ค้นหาเมนู" placeholder="ค้นหาเมนู" value={query} onChange={(event) => setQuery(event.target.value)}
          className="h-12 w-full rounded-xl border border-[#D9C5B0] bg-[#FFFBF6] pl-12 pr-12 text-base text-[#3B2A20] outline-none placeholder:text-[#8A796B] focus-visible:ring-2 focus-visible:ring-[#B4441C]" />
        {query && <button type="button" aria-label="ล้างคำค้นหา" onClick={() => setQuery("")}
          className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#6B5547] hover:bg-[#F1E7DC] focus-visible:outline-2 focus-visible:outline-[#B4441C]"><X aria-hidden="true" size={18} /></button>}
      </label>
      <button type="button" aria-pressed={manageSoldOut} onClick={() => setManageSoldOut((current) => !current)}
        className={`h-12 shrink-0 rounded-xl border px-4 text-base font-semibold ${manageSoldOut ? "border-[#3B2A20] bg-[#3B2A20] text-[#F5EDE3]" : "border-[#D9C5B0] bg-[#FFFBF6] text-[#3B2A20]"}`}>
        {manageSoldOut ? "เสร็จ" : "ของหมด"}
      </button>
    </div>
    {manageSoldOut && <div role="status" className="mb-3 shrink-0 rounded-xl border border-dashed border-[#B4441C] bg-[#F7DCD0] px-4 py-2 text-sm font-semibold text-[#8E3415]">แตะเมนูเพื่อสลับ หมด/มีขาย</div>}
    {products.length === 0 ? <div className="flex flex-1 items-center justify-center text-lg text-[#6B5547]">{searchTerm ? "ไม่พบเมนูที่ค้นหา" : "ยังไม่มีเมนูในหมวดหมู่นี้"}</div> :
      <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] content-start gap-3">
        {products.map((product) => {
          const soldOut = soldOutOverrides[product.id] ?? product.soldOut;
          return <button key={product.id} data-product-card data-product-id={product.id} type="button" aria-disabled={!manageSoldOut && soldOut}
            onClick={() => manageSoldOut ? void changeSoldOut(product.id, soldOut) : soldOut ? showNotice("เมนูนี้หมดแล้ว") : onChoose(product.id)}
            className={`relative flex min-w-0 flex-col gap-2 rounded-[18px] border bg-[#FFFBF6] p-2.5 text-left text-[#3B2A20] shadow-[0_3px_12px_rgba(59,42,32,0.04)] transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.97] active:shadow-sm motion-reduce:transform-none motion-reduce:transition-none ${manageSoldOut ? "border-dashed border-[#B4441C]" : "border-[#E4D6C6]"} ${!manageSoldOut && soldOut ? "opacity-55 grayscale" : ""} ${pendingIds.has(product.id) ? "pointer-events-none" : ""}`}>
          {product.imageUrl ? <Image src={product.imageUrl} alt="" width={400} height={96} unoptimized className="h-24 w-full rounded-xl bg-[#F5EDE3] object-contain" /> :
            <ProductTile name={product.name} tileColor={product.tileColor} className="h-24 w-full rounded-xl text-4xl" />}
          {soldOut && <span className="absolute right-4 top-4 rounded-full bg-[#3B2A20] px-3 py-1 text-sm font-bold text-white">หมด</span>}
          <span className="flex min-h-11 w-full items-center justify-between gap-2"><span className="line-clamp-2 min-w-0 text-base font-semibold leading-tight">{product.name}</span>
            <span className="shrink-0 text-base font-bold tabular-nums text-[#B4441C]">{formatBaht(product.basePriceSatang)}</span></span>
          </button>;
        })}
      </div>}
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#3B2A20] px-5 py-3 text-base font-semibold text-white shadow-xl">{notice}</div>}
  </main>;
}
