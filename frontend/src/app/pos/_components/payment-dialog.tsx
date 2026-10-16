"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatBaht } from "@/lib/money";
import { suggestCashAmounts } from "@/lib/pricing";
import type { CheckoutInput, CheckoutResult } from "@/server/orders";
import { checkoutAction } from "@/app/pos/checkout-actions";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Keypad } from "./keypad";
import { PromptPayQr } from "./promptpay-qr";
import { trapDialogTab } from "@/lib/dialog-focus";

type PaymentLine = { key: string; name: string; qty: number; modifiersText: string; lineTotalSatang: number };
type PaymentDialogProps = {
  orderLabel: string;
  lines: PaymentLine[];
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  checkoutInput: Omit<CheckoutInput, "payment">;
  promptpayEnabled: boolean;
  shopName: string;
  onClose: () => void;
  onPaid: (result: CheckoutResult, method: "cash" | "promptpay") => void;
};

type PaymentMethod = "cash" | "promptpay";

function AnimatedBaht({ satang, className }: { satang: number; className?: string }) {
  const amountRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(satang);

  useGSAP(() => {
    const element = amountRef.current;
    if (!element) return;
    const from = previous.current;
    previous.current = satang;
    if (prefersReducedMotion()) {
      element.textContent = formatBaht(satang);
      return;
    }
    const counter = { value: from };
    gsap.to(counter, {
      value: satang,
      duration: MOTION.base,
      ease: "power2.out",
      onUpdate: () => { element.textContent = formatBaht(Math.round(counter.value)); },
    });
  }, { scope: amountRef, dependencies: [satang], revertOnUpdate: true });

  return <span ref={amountRef} className={className}>{formatBaht(satang)}</span>;
}

export function PaymentDialog({ orderLabel, lines, subtotalSatang, discountSatang, totalSatang,
  checkoutInput, promptpayEnabled, shopName, onClose, onPaid }: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState("");
  const [pending, setPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGLineElement>(null);
  const receivedSatang = Number.parseInt(cashInput || "0", 10) * 100;
  const changeSatang = receivedSatang - totalSatang;
  const shortBySatang = Math.max(0, -changeSatang);
  const quickAmounts = useMemo(() => suggestCashAmounts(totalSatang), [totalSatang]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: "power1.out" });
    gsap.fromTo(dialogRef.current, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
  }, { scope: rootRef });

  useGSAP(() => {
    if (!indicatorRef.current || prefersReducedMotion()) return;
    gsap.to(indicatorRef.current, { xPercent: method === "cash" ? 0 : 100, duration: MOTION.base, ease: MOTION.ease });
  }, { scope: rootRef, dependencies: [method], revertOnUpdate: true });

  useGSAP(() => {
    if (!contentRef.current || prefersReducedMotion()) return;
    gsap.fromTo(contentRef.current, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: MOTION.base, ease: MOTION.ease });
  }, { scope: rootRef, dependencies: [method], revertOnUpdate: true });

  useGSAP(() => {
    if (!pending || !progressRef.current || prefersReducedMotion()) return;
    gsap.fromTo(progressRef.current, { drawSVG: "0%" }, {
      drawSVG: "100%", duration: 0.7, repeat: -1, repeatDelay: 0.1, ease: "power1.inOut",
    });
  }, { scope: rootRef, dependencies: [pending], revertOnUpdate: true });

  const { contextSafe } = useGSAP({ scope: rootRef });
  const animateClose = contextSafe((root: HTMLDivElement, dialog: HTMLDivElement, complete: () => void) => {
    gsap.timeline({ onComplete: complete })
      .to(dialog, { y: 12, opacity: 0, duration: MOTION.base, ease: MOTION.easeIn }, 0)
      .to(root, { opacity: 0, duration: MOTION.base, ease: "power1.in" }, 0);
  });
  const requestClose = useCallback(() => {
    if (closing) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    const root = rootRef.current;
    const dialog = dialogRef.current;
    if (!root || !dialog) return;
    root.style.pointerEvents = "none";
    setClosing(true);
    animateClose(root, dialog, onClose);
  }, [animateClose, closing, onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, requestClose]);

  async function confirm() {
    if (pending || (method === "cash" && receivedSatang < totalSatang)) return;
    setPending(true);
    setError(null);
    const payment: CheckoutInput["payment"] = method === "cash"
      ? { method: "cash", cashReceivedSatang: receivedSatang }
      : { method: "promptpay" };
    try {
      const response = await checkoutAction({ ...checkoutInput, payment });
      if (!response.ok) {
        setError(response.message);
        setPending(false);
        return;
      }
      onPaid(response.result, method);
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
      setPending(false);
    }
  }

  const isCash = method === "cash";
  const blocked = pending || (isCash && receivedSatang < totalSatang);
  const changeShort = shortBySatang > 0;

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(43,30,22,0.55)] p-3 sm:p-6">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-payment-title`} onKeyDown={trapDialogTab}
        className="flex h-[min(680px,calc(100dvh-24px))] w-full max-w-[1000px] overflow-hidden rounded-[24px] border border-white/60 bg-[#FFFBF6] shadow-[0_24px_80px_rgba(43,30,22,0.25)] outline-none">
        <aside className="flex w-[36%] min-w-[260px] shrink-0 flex-col gap-3 bg-gradient-to-b from-[#F7F0E7] to-[#F0E4D7] p-7">
        <h2 id={`${id}-payment-title`} className="text-base text-[#6B5547]">ออเดอร์ {orderLabel}</h2>
          <div className="min-h-0 space-y-3 overflow-y-auto">
            {lines.map((line) => (
              <div key={line.key} className="flex justify-between gap-2 text-base">
                <div className="min-w-0"><div>{line.qty} × {line.name}</div>
                  {line.modifiersText && <div className="text-sm text-[#6B5547]">{line.modifiersText}</div>}
                </div>
                <span className="shrink-0 tabular-nums">{formatBaht(line.lineTotalSatang)}</span>
              </div>
            ))}
          </div>
          {discountSatang > 0 && <div className="flex justify-between text-base font-semibold text-[#2F6B3F]">
            <span>รางวัลสมาชิก</span><span className="tabular-nums">−{formatBaht(discountSatang)}</span>
          </div>}
          <div className="mt-auto border-t border-[#E0CFBD] pt-3">
            <div className="flex justify-between text-sm text-[#6B5547]"><span>รวม</span><span className="tabular-nums">{formatBaht(subtotalSatang)}</span></div>
            <div className="mt-1 text-lg font-semibold">ยอดชำระ</div>
            <div className="text-[clamp(40px,5vw,56px)] font-bold leading-[1.1] tabular-nums">{formatBaht(totalSatang)}</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4 p-6 sm:p-7">
          <div role="tablist" aria-label="วิธีชำระ" className="relative grid grid-cols-2 rounded-[18px] bg-[#F1E7DC] p-1.5">
            <span ref={indicatorRef} aria-hidden="true" className="absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-[14px] bg-[#3B2A20] shadow-sm" />
            <button type="button" role="tab" aria-selected={isCash} onClick={() => { setMethod("cash"); setError(null); }}
              className={`relative z-10 h-[60px] rounded-[14px] text-lg font-bold transition-colors ${isCash ? "text-[#F5EDE3]" : "text-[#3B2A20]"}`}>เงินสด</button>
            <button type="button" role="tab" aria-selected={!isCash} disabled={!promptpayEnabled}
              onClick={() => { if (promptpayEnabled) { setMethod("promptpay"); setError(null); } }}
              className={`relative z-10 h-[60px] rounded-[14px] text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:text-[#8A796B] ${isCash ? "text-[#3B2A20]" : "text-[#F5EDE3]"}`}>พร้อมเพย์</button>
          </div>
          {!promptpayEnabled && <p className="-mt-3 text-sm text-[#6B5547]">ยังไม่ได้ตั้งค่าพร้อมเพย์ในหลังร้าน</p>}

          <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
            {isCash ? <div className="flex min-h-0 flex-1 gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="rounded-2xl border border-[#D9C5B0] bg-white/60 px-4 py-2.5 shadow-[0_2px_8px_rgba(59,42,32,0.04)]">
                  <div className="text-sm text-[#6B5547]">รับเงินมา</div>
                  <AnimatedBaht satang={receivedSatang} className="block text-[40px] font-bold leading-tight tabular-nums" />
                </div>
                <div className={`rounded-2xl border px-4 py-2.5 transition-colors duration-200 ${changeShort ? "border-[#E9B29B] bg-[#F7DCD0] text-[#8E3415]" : "border-[#BDD3C0] bg-[#E7F1E8] text-[#245232]"}`}>
                  <div className="text-sm">เงินทอน</div>
                  <div className="text-[34px] font-bold leading-tight tabular-nums">{changeShort ? `ขาดอีก ${formatBaht(shortBySatang)}` : <AnimatedBaht satang={changeSatang} />}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickAmounts.map((amount, index) => <button key={amount} type="button"
                    className="h-[52px] rounded-[14px] border border-[#D9C5B0] bg-[#FFFBF6] text-base font-bold shadow-[0_2px_5px_rgba(59,42,32,0.04)] transition-colors active:bg-[#F3E8DC]"
                    onClick={() => setCashInput(String(amount))}>{index === 0 ? "พอดี" : formatBaht(amount * 100)}</button>)}
                </div>
              </div>
              <Keypad value={cashInput} onChange={(next) => setCashInput(next.replace(/^0+(?=\d)/, ""))} maxLength={6}
                className="w-[min(280px,43%)] content-start" keyClassName="h-[min(72px,9vh)] min-h-[50px]" />
            </div> : <PromptPayQr amountSatang={totalSatang} shopName={shopName} />}
          </div>

          <div className="flex gap-3">
            <button type="button" disabled={pending || closing} onClick={requestClose}
              className="h-[72px] w-36 shrink-0 rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] text-lg font-semibold shadow-sm disabled:opacity-60">กลับ</button>
            <button type="button" disabled={blocked} onClick={() => void confirm()}
              className="relative h-[72px] min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#2F6B3F] px-3 text-lg font-bold text-white shadow-[0_7px_16px_rgba(47,107,63,0.18)] transition-colors disabled:bg-[#C9B6A4]">
              {pending && <svg className="absolute inset-x-4 bottom-0 h-1.5 w-[calc(100%-2rem)]" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><line ref={progressRef} x1="0" y1="2" x2="100" y2="2" stroke="#D7E8D9" strokeWidth="3" strokeLinecap="round" /></svg>}
              {pending ? "กำลังบันทึก…" : isCash ? (shortBySatang ? "ใส่จำนวนเงินที่รับ" : `รับเงิน · ทอน ${formatBaht(changeSatang)}`) : "ได้รับเงินแล้ว"}
            </button>
          </div>
          {error && <p className="-mt-3 text-sm font-semibold text-[#8E3415]" role="alert">{error}</p>}
        </section>
      </div>
    </div>
  );
}
