"use client";

import { QrCode, Smartphone, X } from "lucide-react";
import Image from "next/image";
import type { MemberSummary } from "@/server/loyalty";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";
import { useRef } from "react";
import { maskPhone, thaiInitial } from "@/lib/thai";

type MemberPanelProps = { member: MemberSummary | null; loading?: boolean; lookupError?: string; redeemRewardId: string | null; onScan: () => void; onPhone: () => void; onRemove: () => void; onToggleReward: () => void };

export function MemberPanel({ member, loading = false, lookupError, redeemRewardId, onScan, onPhone, onRemove, onToggleReward }: MemberPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (!member) return;
    const stamps = gsap.utils.toArray<HTMLElement>("[data-stamp]", panelRef.current);
    const progress = panelRef.current?.querySelector<HTMLElement>("[data-stamp-progress]");
    const ratio = Math.min(1, member.stampBalance / Math.max(1, member.stampGoal));
    if (prefersReducedMotion()) {
      gsap.set(stamps, { scale: 1, opacity: 1 });
      if (progress) gsap.set(progress, { scaleX: ratio });
      return;
    }
    gsap.fromTo(stamps, { scale: 0.8, opacity: 0.45 }, { scale: 1, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.pop });
    if (progress) gsap.fromTo(progress, { scaleX: 0 }, { scaleX: ratio, duration: MOTION.slow, ease: MOTION.ease, delay: 0.08 });
  }, { scope: panelRef, dependencies: [member?.id, member?.stampBalance, member?.stampGoal] });

  if (loading && !member) return <section aria-live="polite" className="flex flex-col gap-3 border-b border-[#E4D6C6] p-[14px_16px]">
    <div className="flex items-center gap-3"><span className="size-11 animate-pulse rounded-full bg-[#EADBC8] motion-reduce:animate-none" /><div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-[#EADBC8] motion-reduce:animate-none" /><div className="h-3 w-full animate-pulse rounded bg-[#EFE3D5] motion-reduce:animate-none" /></div></div>
    <div className="flex gap-1.5">{Array.from({ length: 8 }, (_, i) => <span key={i} className="size-[30px] animate-pulse rounded-full bg-[#EFE3D5] motion-reduce:animate-none" />)}</div>
    <span className="sr-only">กำลังโหลดข้อมูลสมาชิก</span>
  </section>;
  if (!member) return <section className="flex flex-col gap-2 border-b border-[#E4D6C6] p-[14px_16px]">
    <div className="flex gap-2.5">
      <button type="button" onClick={onScan} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#3B2A20] text-base font-semibold text-[#F5EDE3]"><QrCode aria-hidden="true" size={22} />สแกนบัตรสมาชิก</button>
      <button type="button" onClick={onPhone} className="flex h-14 w-32 items-center justify-center gap-1.5 rounded-[14px] border border-[#D9C5B0] bg-[#FFFBF6] text-base font-semibold"><Smartphone aria-hidden="true" size={20} />เบอร์โทร</button>
    </div>
    {lookupError && <p role="alert" className="rounded-xl bg-[#F7DCD0] px-3 py-2 text-sm font-semibold text-[#8E3415]">{lookupError}</p>}
  </section>;

  return <section ref={panelRef} className="flex flex-col gap-2.5 border-b border-[#E4D6C6] p-[14px_16px]">
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-full bg-[#06C755] text-lg font-bold text-white">{thaiInitial(member.displayName)}</span>
      <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[17px] font-bold">{member.displayName}</div><div className="text-sm text-[#6B5547]">{maskPhone(member.phone) || "ไม่ระบุเบอร์"} · สะสม {member.stampBalance}/{member.stampGoal}</div></div>
      <button type="button" aria-label="นำสมาชิกออก" onClick={onRemove} className="flex size-11 items-center justify-center rounded-xl border border-[#E4D6C6] bg-[#FFFBF6] text-[#6B5547]"><X aria-hidden="true" size={18} /></button>
    </div>
    <div aria-label={`แสตมป์ ${member.stampBalance} จาก ${member.stampGoal}`} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: member.stampGoal }, (_, index) => <span data-stamp key={index} className="inline-flex"><Image src={index < member.stampBalance ? "/assets/stamp-filled.png" : "/assets/stamp-empty.png"} alt="" width={30} height={30} className="size-[30px]" /></span>)}
      </div>
      {/* Straight progress bar: scaleX on a div (DrawSVG dashes repeat on stretched lines). */}
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-[#EADBC8]">
        <div data-stamp-progress className="h-full w-full origin-left scale-x-0 rounded-full bg-[#B4441C]" />
      </div>
    </div>
    {member.availableRewards.length > 0 && <button type="button" aria-pressed={Boolean(redeemRewardId)} onClick={onToggleReward}
      className={`flex h-[52px] items-center gap-2.5 rounded-[14px] border-2 px-3 text-[15px] font-semibold transition-colors duration-150 ${redeemRewardId ? "border-[#2F6B3F] bg-[#E7F1E8]" : "border-[#C69C72] bg-[#FFFBF6]"}`}>
      <Image src="/assets/reward-free-drink.png" alt="" width={36} height={36} className="size-9" />
      <span className="flex-1 text-left">{redeemRewardId ? "ใช้รางวัล: เครื่องดื่มฟรี 1 แก้ว" : `มีรางวัล: เครื่องดื่มฟรี ${member.availableRewards.length} แก้ว`}</span>
      <span className="text-sm text-[#B4441C]">{redeemRewardId ? "ยกเลิก" : "ใช้เลย"}</span>
    </button>}
  </section>;
}
