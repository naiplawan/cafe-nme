"use client";

import type { PosMenu } from "@/lib/pricing";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";
import { useRef } from "react";

type CategoryRailProps = {
  menu: PosMenu;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CategoryRail({ menu, selectedId, onSelect }: CategoryRailProps) {
  const railRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const categories = [{ id: null, name: "ทั้งหมด" }, ...menu.categories];
  useGSAP(() => {
    const rail = railRef.current;
    const indicator = indicatorRef.current;
    const active = rail?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!rail || !indicator || !active) return;
    const y = active.offsetTop - 16;
    if (prefersReducedMotion()) gsap.set(indicator, { y });
    else gsap.to(indicator, { y, duration: MOTION.base, ease: MOTION.ease });
    const line = active.querySelector("[data-active-line]");
    if (line) {
      if (prefersReducedMotion()) gsap.set(line, { drawSVG: "100%" });
      else gsap.fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: MOTION.ease });
    }
  }, { scope: railRef, dependencies: [selectedId] });

  return (
    <nav ref={railRef} aria-label="หมวดหมู่" className="relative flex w-full shrink-0 flex-row gap-2 overflow-x-auto md:w-[116px] md:flex-col md:overflow-y-auto border-r border-[#E0CFBD] bg-[#EFE3D5] px-2.5 py-4">
      <span ref={indicatorRef} aria-hidden="true" className="pointer-events-none hidden md:block absolute left-2.5 right-2.5 top-4 h-[84px] rounded-[14px] bg-[#4A2C1A] shadow-[0_5px_14px_rgba(59,42,32,0.14)]" />
      {categories.map((category) => {
        const count = menu.products.filter((product) => category.id === null || product.categoryId === category.id).length;
        const selected = selectedId === category.id;
        return <button key={category.id ?? "all"} type="button" aria-pressed={selected} onClick={() => onSelect(category.id)}
          className={`relative z-10 flex min-h-14 min-w-24 shrink-0 md:min-h-[84px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-[17px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${selected ? "bg-[#4A2C1A] md:bg-transparent text-[#F7F1E7]" : "text-[#4A2C1A]"}`}>
          {selected && <svg aria-hidden="true" className="absolute right-1 top-1/2 h-8 w-1 -translate-y-1/2" viewBox="0 0 4 32" fill="none">
            <path data-active-line d="M2 1V31" stroke="#D9653B" strokeWidth="3" strokeLinecap="round" />
          </svg>}
          {category.name}<span className="text-[13px] font-medium opacity-80">{count} รายการ</span>
        </button>;
      })}
    </nav>
  );
}
