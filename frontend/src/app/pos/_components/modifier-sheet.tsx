"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatBaht } from "@/lib/money";
import type { PosProduct } from "@/lib/pricing";
import Image from "next/image";
import { ProductTile } from "@/components/product-tile";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";
import { trapDialogTab } from "@/lib/dialog-focus";

type ModifierSheetProps = {
  product: PosProduct;
  initialModifierIds?: string[];
  initialQty?: number;
  isEditing?: boolean;
  onClose: () => void;
  onConfirm: (modifierIds: string[], qty: number) => void;
  onRemove?: () => void;
};

export function ModifierSheet({ product, initialModifierIds = [], initialQty = 1, isEditing = false, onClose, onConfirm, onRemove }: ModifierSheetProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const invalidAttemptRef = useRef<() => void>(() => {});
  const [selected, setSelected] = useState<string[]>(initialModifierIds);
  const [qty, setQty] = useState(initialQty);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  useGSAP((_, contextSafe = (callback) => callback()) => {
    const panel = dialogRef.current;
    if (panel && !prefersReducedMotion()) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
      gsap.fromTo(panel, { y: 12, scale: 0.985, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    }
    invalidAttemptRef.current = contextSafe(() => {
      if (prefersReducedMotion()) return;
      const missing = dialogRef.current?.querySelectorAll<HTMLElement>("[data-required-badge][data-missing='true']");
      if (missing) gsap.fromTo(missing, { scale: 1 }, { scale: 1.06, duration: MOTION.fast / 2, repeat: 1, yoyo: true, ease: "sine.inOut" });
    });
  }, { scope: dialogRef });

  useGSAP(() => {
    const checks = gsap.utils.toArray<SVGPathElement>("[data-modifier-check]", dialogRef.current);
    if (prefersReducedMotion()) gsap.set(checks, { drawSVG: "100%" });
    else gsap.fromTo(checks, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.fast, ease: MOTION.ease });
  }, { scope: dialogRef, dependencies: [selected] });

  const chosen = useMemo(() => new Set(selected), [selected]);
  const valid = product.groups.every((group) => {
    const count = group.modifiers.filter((modifier) => chosen.has(modifier.id)).length;
    return count >= group.minSelect && count <= group.maxSelect;
  });
  const unitPrice = Math.max(0, product.basePriceSatang + product.groups.flatMap((group) => group.modifiers)
    .filter((modifier) => chosen.has(modifier.id)).reduce((sum, modifier) => sum + modifier.priceDeltaSatang, 0));

  function toggle(groupId: string, modifierId: string, maxSelect: number) {
    const group = product.groups.find((item) => item.id === groupId);
    if (!group) return;
    setSelected((current) => {
      const inGroup = current.filter((id) => group.modifiers.some((modifier) => modifier.id === id));
      const rest = current.filter((id) => !group.modifiers.some((modifier) => modifier.id === id));
      if (inGroup.includes(modifierId)) return [...rest, ...inGroup.filter((id) => id !== modifierId)];
      if (inGroup.length >= maxSelect) return [...rest, ...inGroup.slice(1), modifierId];
      return [...current, modifierId];
    });
  }

  return <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
    <button ref={backdropRef} type="button" tabIndex={-1} aria-label="ปิดหน้าต่าง" onClick={onClose} className="absolute inset-0 bg-[rgba(43,30,22,0.55)]" />
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-modifier-title`} onKeyDown={(event) => { trapDialogTab(event); if (event.key === "Escape") onClose(); }}
      className="relative z-10 flex h-[min(660px,calc(100dvh-32px))] w-[min(900px,calc(100vw-32px))] overflow-hidden rounded-3xl border border-[#E4D6C6] bg-[#FFFBF6] shadow-[0_24px_70px_rgba(43,30,22,0.22)] outline-none">
      <div className="flex w-[280px] shrink-0 flex-col gap-3 bg-[#F5EDE3] p-6">
        {product.imageUrl ? <Image src={product.imageUrl} alt="" width={232} height={232} unoptimized className="size-[232px] object-contain" /> :
          <ProductTile name={product.name} tileColor={product.tileColor} className="size-[232px] rounded-2xl text-[80px]" />}
        <h2 id={`${id}-modifier-title`} className="text-[26px] font-bold">{product.name}</h2>
        {isEditing && <p className="-mt-2 text-sm font-medium text-[#8A6A4F]">แก้ไขรายการในออเดอร์</p>}
        <p className="text-[17px] text-[#6B5547]">ราคาเริ่มต้น {formatBaht(product.basePriceSatang)}</p>
        <div className="mt-auto flex flex-col gap-2">
          <span className="text-[15px] font-semibold">จำนวน</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="ลดจำนวน" disabled={qty <= 1} onClick={() => setQty((value) => Math.max(1, value - 1))} className="flex size-16 items-center justify-center rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] disabled:opacity-40"><Minus aria-hidden="true" size={24} /></button>
            <span className="flex-1 text-center text-[28px] font-bold">{qty}</span>
            <button type="button" aria-label="เพิ่มจำนวน" disabled={qty >= 99} onClick={() => setQty((value) => Math.min(99, value + 1))} className="flex size-16 items-center justify-center rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] disabled:opacity-40"><Plus aria-hidden="true" size={24} /></button>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 space-y-[22px] overflow-y-auto p-6 min-[700px]:px-7">
          {product.groups.map((group) => {
            const count = group.modifiers.filter((modifier) => chosen.has(modifier.id)).length;
            const missing = count < group.minSelect;
            const rule = group.minSelect > 0 ? `ต้องเลือก ${group.minSelect}` : group.maxSelect === 1 ? "ไม่บังคับ" : `เลือกได้สูงสุด ${group.maxSelect}`;
            return <section key={group.id} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5"><h3 className="text-[19px] font-bold">{group.name}</h3>
                <span data-required-badge data-missing={missing} className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${missing ? "bg-[#F7DCD0] text-[#8E3415]" : "bg-[#EFE3D5] text-[#6B5547]"}`}>{rule}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-4">
                {group.modifiers.map((modifier) => {
                  const isSelected = chosen.has(modifier.id);
                  return <button key={modifier.id} type="button" aria-pressed={isSelected} onClick={() => toggle(group.id, modifier.id, group.maxSelect)}
                    className={`relative flex h-16 flex-col items-center justify-center rounded-[14px] border text-[17px] font-semibold leading-tight transition-[background-color,border-color,color] duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${isSelected ? "border-[#3B2A20] bg-[#3B2A20] text-[#F5EDE3]" : "border-[#D9C5B0] bg-[#FFFBF6] text-[#3B2A20]"}`}>
                    {isSelected && <svg aria-hidden="true" className="absolute right-2 top-2 size-4" viewBox="0 0 16 16" fill="none"><path data-modifier-check d="m2 8 4 4 8-9" stroke="#D9653B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    {modifier.name}<span className="text-[13px] font-medium">{modifier.priceDeltaSatang ? `+${formatBaht(modifier.priceDeltaSatang)}` : "ไม่เพิ่มราคา"}</span>
                  </button>;
                })}
              </div>
            </section>;
          })}
        </div>
        <div className="flex gap-3 border-t border-[#E4D6C6] p-4 min-[700px]:px-7 min-[700px]:pb-6">
          <button type="button" onClick={onClose} className={`h-[68px] rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] text-lg font-semibold ${isEditing ? "w-28" : "w-40"}`}>ยกเลิก</button>
          {isEditing && <button type="button" onClick={onRemove} className="h-[68px] rounded-2xl px-3 text-sm font-semibold text-[#B4441C] hover:bg-[#F7DCD0]">ลบรายการนี้</button>}
          <button type="button" onClick={() => valid ? onConfirm(selected, qty) : invalidAttemptRef.current()} className={`h-[68px] min-w-0 flex-1 rounded-2xl bg-[#B4441C] font-bold text-white shadow-sm ${isEditing ? "text-lg" : "text-xl"}`}>
            {valid ? `${isEditing ? "บันทึกการแก้ไข" : "เพิ่มลงออเดอร์"} · ${formatBaht(unitPrice * qty)}` : "เลือกตัวเลือกที่ต้องเลือกก่อน"}
          </button>
        </div>
      </div>
    </div>
  </div>;
}
