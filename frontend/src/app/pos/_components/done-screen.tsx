"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Printer } from "lucide-react";
import { formatBaht } from "@/lib/money";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import type { CheckoutResult } from "@/server/orders";
import { sendReceiptToLine } from "@/app/pos/checkout-actions";

type DoneScreenProps = {
  result: CheckoutResult;
  method: "cash" | "promptpay";
  onNewOrder: () => void;
};

export function DoneScreen({ result, method, onNewOrder }: DoneScreenProps) {
  const newOrderRef = useRef<HTMLButtonElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const successRef = useRef<HTMLSpanElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const orderRef = useRef<HTMLSpanElement>(null);
  const changeRef = useRef<HTMLDivElement>(null);
  const stampRefs = useRef<HTMLSpanElement[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<SVGLineElement[]>([]);
  const [sending, setSending] = useState(false);
  const [lineMessage, setLineMessage] = useState<string | null>(null);
  const member = result.member;
  const stampGoal = member?.stampGoal ?? 0;
  const stampCount = Math.min(stampGoal, 12);
  const stampBalance = member ? member.stampBalance % Math.max(1, stampGoal) : 0;
  const previousBalance = member ? (stampBalance - result.stampsEarned + stampGoal) % Math.max(1, stampGoal) : 0;
  const earnedCount = Math.min(result.stampsEarned, stampGoal);
  const progressPercent = stampGoal ? Math.min(100, (stampBalance / stampGoal) * 100) : 0;
  const orderLabel = `#${String(result.dailyNo).padStart(3, "0")}`;

  useEffect(() => { newOrderRef.current?.focus(); }, []);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const timeline = gsap.timeline();
    timeline.fromTo(successRef.current, { scale: 0.55, opacity: 0 }, {
      scale: 1, opacity: 1, duration: 0.2, ease: MOTION.pop,
    }, 0);
    timeline.fromTo(checkRef.current, { drawSVG: "0%" }, {
      drawSVG: "100%", duration: 0.24, ease: "power2.out",
    }, 0.1);
    const counter = { value: 0 };
    timeline.fromTo(orderRef.current, { y: 12, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.2, ease: MOTION.ease,
    }, 0.22);
    timeline.to(counter, {
      value: result.dailyNo, duration: 0.22, ease: "power2.out",
      onUpdate: () => {
        if (orderRef.current) orderRef.current.textContent = `#${String(Math.round(counter.value)).padStart(3, "0")}`;
      },
    }, 0.22);
    if (method === "cash") {
      timeline.fromTo(changeRef.current, { y: 10, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.18, ease: MOTION.ease,
      }, 0.4);
    }
    if (member && stampRefs.current.length) {
      const newStamps = stampRefs.current.filter((_, index) => {
        const relativeIndex = (index - previousBalance + stampGoal) % Math.max(1, stampGoal);
        return relativeIndex < earnedCount;
      });
      if (newStamps.length) timeline.fromTo(newStamps, { scale: 0.55, opacity: 0.65 }, {
        scale: 1, opacity: 1, duration: 0.16, stagger: MOTION.stagger, ease: MOTION.pop,
      }, 0.48);
      timeline.fromTo(progressRef.current, { scaleX: 0 }, {
        scaleX: progressPercent / 100, duration: 0.24, ease: "power2.out",
      }, 0.5);
    }
    if (result.rewardsCreated > 0 && raysRef.current.length) {
      timeline.fromTo(raysRef.current, { drawSVG: "0%", opacity: 0.35 }, {
        drawSVG: "100%", opacity: 1, duration: 0.24, stagger: 0.015, ease: "power2.out",
      }, 0.56);
    }
  }, { scope: screenRef });

  async function sendReceipt() {
    if (sending) return;
    setSending(true);
    setLineMessage(null);
    try {
      const response = await sendReceiptToLine(result.orderId);
      setLineMessage(response.message);
    } catch {
      setLineMessage("ส่งใบเสร็จไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSending(false);
    }
  }

  return (
    <main ref={screenRef} className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#FFF9F1_0%,#F5EDE3_56%)] p-5 text-center text-[#3B2A20]">
      <div className="flex w-full max-w-[620px] flex-col items-center gap-3.5 py-4">
        <span ref={successRef} role="img" className="flex size-24 items-center justify-center rounded-full bg-[#2F6B3F] text-white shadow-[0_10px_26px_rgba(47,107,63,0.22)]" aria-label="ชำระเงินสำเร็จ">
          <svg className="size-[52px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path ref={checkRef} d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="text-xl text-[#6B5547]">ชำระเงินเรียบร้อย · ออเดอร์</div>
        <span ref={orderRef} className="text-[72px] font-bold leading-none tabular-nums">{orderLabel}</span>

        {method === "cash" && <div ref={changeRef} className="rounded-[18px] border border-[#E4D6C6] bg-[#FFFBF6] px-8 py-2.5 shadow-[0_4px_14px_rgba(59,42,32,0.05)]">
          <span className="text-lg text-[#6B5547]">เงินทอน </span><span className="text-[40px] font-bold tabular-nums">{formatBaht(result.changeSatang)}</span>
        </div>}

        {member && <div className="flex items-center gap-3 rounded-[18px] border border-[#E4D6C6] bg-[#FFFBF6] px-5 py-3 text-left shadow-[0_4px_14px_rgba(59,42,32,0.04)]">
          <Image src="/assets/stamp-filled.png" alt="" width={36} height={36} className="size-9 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-base">{member.displayName} ได้ <b>+{result.stampsEarned} แสตมป์</b> · ตอนนี้ {member.stampBalance}/{member.stampGoal}</p>
            <div role="img" className="mt-2 inline-flex flex-col gap-1.5" aria-label={`สะสม ${member.stampBalance} จาก ${member.stampGoal} แสตมป์`}>
              <div className="flex items-center gap-1">
                {Array.from({ length: stampCount }, (_, index) => index + 1).map((stampNumber) => {
                  const index = stampNumber - 1;
                  const isNew = ((index - previousBalance + stampGoal) % Math.max(1, stampGoal)) < earnedCount;
                  const filled = index < stampBalance || isNew;
                  return <span key={stampNumber} ref={(element) => { if (element) stampRefs.current[index] = element; }} className="inline-flex size-8 items-center justify-center">
                    <Image src={filled ? "/assets/stamp-filled.png" : "/assets/stamp-empty.png"} alt="" width={32} height={32} className="size-8 object-contain" />
                  </span>;
                })}
              </div>
              {/* Progress bar under the full stamp row, over a faint track. */}
              <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-[#EADBC8]">
                <div ref={progressRef} className="h-full w-full origin-left rounded-full bg-[#B4441C]" style={{ transform: `scaleX(${progressPercent / 100})` }} />
              </div>
            </div>
          </div>
        </div>}

        {result.rewardsCreated > 0 && <div className="relative px-7 py-1 text-[17px] font-semibold text-[#2F6B3F]">
          <Image src="/assets/reward-free-drink.png" alt="" width={24} height={24} className="mr-1 inline-block size-6 align-middle object-contain" />
          <span className="relative z-10">ครบแล้ว! ได้เครื่องดื่มฟรี {result.rewardsCreated} แก้ว</span>
          <svg className="pointer-events-none absolute inset-x-0 top-0 h-full w-full overflow-visible" viewBox="0 0 260 44" preserveAspectRatio="none" aria-hidden="true">
            <line ref={(element) => { if (element) raysRef.current[0] = element; }} x1="18" y1="22" x2="4" y2="22" stroke="#C69C72" strokeWidth="2.5" strokeLinecap="round" />
            <line ref={(element) => { if (element) raysRef.current[1] = element; }} x1="30" y1="7" x2="20" y2="1" stroke="#C69C72" strokeWidth="2.5" strokeLinecap="round" />
            <line ref={(element) => { if (element) raysRef.current[2] = element; }} x1="242" y1="22" x2="256" y2="22" stroke="#C69C72" strokeWidth="2.5" strokeLinecap="round" />
            <line ref={(element) => { if (element) raysRef.current[3] = element; }} x1="230" y1="7" x2="240" y2="1" stroke="#C69C72" strokeWidth="2.5" strokeLinecap="round" />
            <line ref={(element) => { if (element) raysRef.current[4] = element; }} x1="45" y1="39" x2="38" y2="43" stroke="#C69C72" strokeWidth="2.5" strokeLinecap="round" />
            <line ref={(element) => { if (element) raysRef.current[5] = element; }} x1="215" y1="39" x2="222" y2="43" stroke="#C69C72" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>}

        <div className="mt-2 flex w-full gap-3">
          <Link href={`/pos/receipt/${result.orderId}`} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] text-base font-semibold text-[#3B2A20] shadow-sm">
            <Printer aria-hidden="true" className="size-[22px]" />พิมพ์ใบเสร็จ
          </Link>
          {member?.lineLinked && <button type="button" disabled={sending} onClick={() => void sendReceipt()}
            className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] text-base font-semibold shadow-sm disabled:opacity-60">
            <MessageCircle aria-hidden="true" className="size-[22px]" />{sending ? "กำลังส่ง…" : "ส่งใบเสร็จทาง LINE"}
          </button>}
        </div>
        {lineMessage && <p role="status" className="text-sm text-[#6B5547]">{lineMessage}</p>}
        <button ref={newOrderRef} type="button" onClick={onNewOrder}
          className="h-[76px] w-full rounded-[18px] bg-[#3B2A20] text-[22px] font-bold text-[#F5EDE3] shadow-[0_8px_20px_rgba(59,42,32,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4441C]">เริ่มออเดอร์ใหม่</button>
      </div>
    </main>
  );
}
