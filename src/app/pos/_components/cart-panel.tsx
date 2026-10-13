"use client";

import { Coffee } from "lucide-react";
import type { CartLineInput, PosMenu, PricedLine } from "@/lib/pricing";
import { formatBaht } from "@/lib/money";
import type { MemberSummary } from "@/server/loyalty";
import { MemberPanel } from "@/app/pos/_components/member-panel";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";
import { useRef } from "react";

type CartPanelProps = {
  lines: CartLineInput[];
  pricedLines: PricedLine[];
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  menu: PosMenu;
  member: MemberSummary | null;
  redeemRewardId: string | null;
  online: boolean;
  onQuantity: (index: number, delta: number) => void;
  onEdit: (index: number) => void;
  onScan: () => void;
  onPhone: () => void;
  onRemoveMember: () => void;
  onToggleReward: () => void;
  onPay: () => void;
  memberLoading?: boolean;
  memberLookupError?: string;
};

export function CartPanel({ lines, pricedLines, subtotalSatang, discountSatang, totalSatang, menu, member, redeemRewardId, online,
  onQuantity, onEdit, onScan, onPhone, onRemoveMember, onToggleReward, onPay, memberLoading = false, memberLookupError }: CartPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const previousTotalRef = useRef(totalSatang);
  const payRef = useRef<HTMLButtonElement>(null);
  const removeLineWithMotionRef = useRef<(index: number) => void>(() => {});
  const wasEmptyRef = useRef(lines.length === 0);
  const itemCount = lines.reduce((total, line) => total + line.qty, 0);
  const productNames = new Map(menu.products.map((product) => [product.id, product.name]));
  const soldOutIds = new Set(menu.products.filter((product) => product.soldOut).map((product) => product.id));

  useGSAP((_, contextSafe = (callback) => callback()) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-cart-line]", panelRef.current);
    const freshRows = rows.filter((row) => {
      const key = row.dataset.lineKey ?? "";
      if (row.dataset.seen === "true") return false;
      row.dataset.seen = "true";
      return Boolean(key);
    });
    if (prefersReducedMotion()) gsap.set(freshRows, { clearProps: "opacity,transform" });
    else gsap.fromTo(freshRows, { y: 7, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease, clearProps: "transform,opacity" });
    removeLineWithMotionRef.current = contextSafe((index: number) => {
      const line = panelRef.current?.querySelectorAll<HTMLElement>("[data-cart-line]")[index];
      if (line && !prefersReducedMotion()) {
        const rect = line.getBoundingClientRect();
        const clone = line.cloneNode(true) as HTMLElement;
        Object.assign(clone.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, zIndex: "80", pointerEvents: "none", transformOrigin: "top" });
        document.body.append(clone);
        gsap.to(clone, { x: 16, opacity: 0, scaleY: 0.88, duration: MOTION.base, ease: MOTION.ease, onComplete: () => clone.remove() });
        window.setTimeout(() => clone.remove(), MOTION.base * 1000 + 120);
      }
      onQuantity(index, -1);
    });
  }, { scope: panelRef, dependencies: [lines] });

  useGSAP(() => {
    const element = totalRef.current;
    if (!element) return;
    const previous = previousTotalRef.current;
    previousTotalRef.current = totalSatang;
    if (prefersReducedMotion()) { element.textContent = formatBaht(totalSatang); return; }
    const value = { amount: previous };
    gsap.to(value, { amount: totalSatang, duration: MOTION.base, ease: MOTION.ease, onUpdate: () => { element.textContent = formatBaht(Math.round(value.amount)); } });
  }, { scope: panelRef, dependencies: [totalSatang] });

  useGSAP(() => {
    const becameNonEmpty = wasEmptyRef.current && lines.length > 0;
    wasEmptyRef.current = lines.length === 0;
    const shine = payRef.current?.querySelector<HTMLElement>("[data-pay-shine]");
    if (!becameNonEmpty || !shine || prefersReducedMotion()) return;
    gsap.fromTo(shine, { xPercent: -140, opacity: 0.8 }, { xPercent: 140, opacity: 0, duration: 0.55, ease: MOTION.ease });
  }, { scope: panelRef, dependencies: [lines.length] });

  return <aside ref={panelRef} data-cart-panel aria-label="ออเดอร์ปัจจุบัน" className="flex w-[min(404px,34vw)] min-w-[320px] shrink-0 flex-col border-l border-[#E4D6C6] bg-[#FFFBF6] shadow-[-8px_0_24px_rgba(59,42,32,0.035)]">
    <MemberPanel member={member} loading={memberLoading} lookupError={memberLookupError} redeemRewardId={redeemRewardId} onScan={onScan} onPhone={onPhone} onRemove={onRemoveMember} onToggleReward={onToggleReward} />
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5">
      {lines.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[#6B5547]">
        <Coffee aria-hidden="true" size={44} className="text-[#C69C72]" /><span className="text-[17px] font-semibold">ยังไม่มีรายการ</span><span className="text-sm">แตะเมนูทางซ้ายเพื่อเริ่มออเดอร์</span>
      </div> : lines.map((line, index) => {
        const priced = pricedLines[index];
        const modifiersText = priced?.modifiers.map((modifier) => modifier.name).join(" · ") ?? "";
        const lineKey = `${line.productId}:${[...line.modifierIds].sort().join(",")}`;
        return <div key={lineKey} data-cart-line data-line-key={lineKey} className="flex gap-2.5 border-b border-[#EFE3D5] py-3">
          <button type="button" onClick={() => onEdit(index)} aria-label={`แก้ไข ${productNames.get(line.productId) ?? priced?.name}${modifiersText ? ` ${modifiersText}` : ""}`}
            className="min-h-11 min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[#B4441C]">
            <div className="text-[17px] font-semibold">{productNames.get(line.productId) ?? priced?.name}</div>{soldOutIds.has(line.productId) ? <div className="text-sm font-semibold text-[#8E3415]">หมดแล้ว — กด − เพื่อนำออก</div> : <div className="text-sm text-[#6B5547]">{modifiersText || "แตะเพื่อแก้ไขรายการ"}</div>}
            <div className="mt-1 text-[15px] font-bold tabular-nums">{formatBaht(priced?.lineTotalSatang ?? 0)}</div></button>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={`ลดจำนวน ${productNames.get(line.productId)}`} onClick={() => line.qty === 1 ? removeLineWithMotionRef.current(index) : onQuantity(index, -1)} className="size-11 rounded-xl border border-[#D9C5B0] bg-[#FFFBF6] text-[22px] active:scale-[0.97] motion-reduce:transition-none">−</button>
            <span className="w-8 text-center text-lg font-bold">{line.qty}</span>
            <button type="button" aria-label={`เพิ่มจำนวน ${productNames.get(line.productId)}`} onClick={() => onQuantity(index, 1)} disabled={line.qty >= 99} className="size-11 rounded-xl border border-[#D9C5B0] bg-[#FFFBF6] text-[22px] disabled:opacity-40">+</button>
          </div>
        </div>;
      })}
    </div>
    <footer className="flex shrink-0 flex-col gap-1.5 border-t border-[#E4D6C6] p-[14px_16px_16px]">
      <div className="flex justify-between text-[15px] text-[#6B5547]"><span>รวม {itemCount} รายการ</span><span className="tabular-nums">{formatBaht(subtotalSatang)}</span></div>
      {discountSatang > 0 && <div className="flex justify-between text-[15px] font-semibold text-[#2F6B3F]"><span>ส่วนลดรางวัลสมาชิก</span><span className="tabular-nums">−{formatBaht(discountSatang)}</span></div>}
      <div className="mt-0.5 flex items-baseline justify-between"><span className="text-lg font-semibold">ยอดชำระ</span><span ref={totalRef} className="text-[32px] font-bold tabular-nums">{formatBaht(totalSatang)}</span></div>
      <button ref={payRef} type="button" disabled={!lines.length || !online} onClick={onPay} className="relative mt-1.5 h-[72px] overflow-hidden rounded-2xl bg-[#B4441C] text-[22px] font-bold text-white shadow-[0_5px_12px_rgba(180,68,28,0.18)] transition-transform active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none disabled:bg-[#C9B6A4]">
        <span aria-hidden="true" data-pay-shine className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0" />
        <span className="relative">{online ? `ชำระเงิน ${formatBaht(totalSatang)}` : "ออฟไลน์ — ชำระเงินไม่ได้"}</span></button>
    </footer>
  </aside>;
}
