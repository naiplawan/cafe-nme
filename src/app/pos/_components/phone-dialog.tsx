"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Keypad } from "@/app/pos/_components/keypad";
import { searchMembersByPhone } from "@/app/pos/actions";
import type { MemberSummary } from "@/server/loyalty";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";
import { maskPhone, thaiInitial } from "@/lib/thai";

type PhoneDialogProps = { onClose: () => void; onAttach: (member: MemberSummary) => void };

export function PhoneDialog({ onClose, onAttach }: PhoneDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const backdropStartedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState("");
  const [searchResult, setSearchResult] = useState<{ query: string; members: MemberSummary[] } | null>(null);

  useEffect(() => { dialogRef.current?.focus(); }, []);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    gsap.fromTo(dialogRef.current, { y: 12, scale: 0.985, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
  }, { scope: dialogRef });

  useGSAP(() => {
    const resultRows = gsap.utils.toArray<HTMLElement>("[data-member-result]", resultsRef.current);
    if (prefersReducedMotion()) gsap.set(resultRows, { clearProps: "opacity,transform" });
    else gsap.fromTo(resultRows, { y: 7, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease, clearProps: "transform,opacity" });
  }, { scope: dialogRef, dependencies: [searchResult?.query] });
  useEffect(() => {
    if (phone.length < 4) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void searchMembersByPhone(phone).then((members) => { if (active) setSearchResult({ query: phone, members }); })
        .catch(() => { if (active) setSearchResult({ query: phone, members: [] }); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [phone]);

  const hasCurrentResult = searchResult?.query === phone;
  const members = hasCurrentResult ? searchResult.members : [];
  const loading = phone.length >= 4 && !hasCurrentResult;
  const display = phone ? phone.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (_match, first: string, second: string, third: string) => [first, second, third].filter(Boolean).join("-")) : "0__-___-____";
  return <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,30,22,0.55)] p-4" onPointerDown={(event) => { backdropStartedRef.current = event.target === event.currentTarget; }} onClick={(event) => { if (backdropStartedRef.current && event.target === event.currentTarget) onClose(); backdropStartedRef.current = false; }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="phone-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      className="relative flex max-h-[calc(100dvh-32px)] w-[min(760px,calc(100vw-32px))] gap-6 overflow-y-auto rounded-3xl border border-[#E4D6C6] bg-[#FFFBF6] p-6 shadow-[0_24px_70px_rgba(43,30,22,0.22)] outline-none">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex min-h-11 items-center justify-between gap-2"><h2 id="phone-title" className="text-[22px] font-bold">ค้นหาด้วยเบอร์โทร</h2>
          <button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[#6B5547] transition-colors hover:bg-[#EFE3D5]"><X aria-hidden="true" /></button>
        </div>
        <div aria-live="polite" className="flex h-[68px] items-center rounded-2xl border-2 border-[#3B2A20] px-[18px] text-[30px] font-bold tracking-wide">{display}</div>
        <div ref={resultsRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {phone.length < 4 && <p className="text-[15px] text-[#6B5547]">พิมพ์อย่างน้อย 4 หลักเพื่อค้นหา</p>}
          {loading && <p className="flex items-center gap-2 text-[#6B5547]"><Search aria-hidden="true" size={18} />กำลังค้นหา…</p>}
          {hasCurrentResult && members.length === 0 && <p className="text-[15px] text-[#6B5547]">ไม่พบสมาชิก</p>}
          {members.map((member) => <button data-member-result key={member.id} type="button" onClick={() => { onAttach(member); onClose(); }} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-[#C69C72] bg-[#F5EDE3] p-3 text-left shadow-[0_3px_10px_rgba(59,42,32,0.05)] transition-colors hover:bg-[#EFE3D5]">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#06C755] font-bold text-white">{thaiInitial(member.displayName)}</span>
            <span className="min-w-0 flex-1 leading-tight"><b className="text-[17px]">{member.displayName}</b><br /><span className="text-sm text-[#6B5547]">{maskPhone(member.phone) || "ไม่ระบุเบอร์"} · สะสม {member.stampBalance}/{member.stampGoal} · มีรางวัล {member.availableRewards.length}</span></span>
            <span className="shrink-0 text-[15px] font-bold text-[#B4441C]">เลือก</span>
          </button>)}
        </div>
        <button type="button" onClick={onClose} className="mt-auto h-[60px] rounded-[14px] border border-[#D9C5B0] bg-[#FFFBF6] text-[17px] font-semibold">ยกเลิก</button>
      </div>
      <Keypad value={phone} onChange={(value) => setPhone(value.slice(0, 10))} maxLength={10} className="w-[300px] shrink-0 self-start" />
    </div>
  </div>;
}
