"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatBaht, parseBahtToSatang } from "@/lib/money";
import { suggestCashAmounts } from "@/lib/pricing";
import type { CheckoutInput, CheckoutResult, CheckoutQuote } from "@/server/orders";
import { submitBrowserCheckout } from "@/lib/browser-checkout";
import { checkoutAction, quoteCheckoutAction, releasePromptPayStockAction, reservePromptPayStockAction } from "@/app/pos/checkout-actions";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Keypad } from "./keypad";
import { PromptPayQr } from "./promptpay-qr";
import { trapDialogTab } from "@/lib/dialog-focus";
import { checkoutAttempt, type CheckoutAttempt, type CheckoutSessionScope } from "@/lib/checkout-attempt";

type PaymentLine = { key: string; name: string; qty: number; modifiersText: string; lineTotalSatang: number };
type PaymentDialogProps = {
  orderLabel: string;
  lines: PaymentLine[];
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  checkoutInput: Omit<CheckoutInput, "payment">;
  cartStorageKey: string | null;
  expectedScope: CheckoutSessionScope;
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

export function PaymentDialog({ orderLabel, lines: cartLines, subtotalSatang: cartSubtotal, discountSatang: cartDiscount, totalSatang: cartTotal,
  checkoutInput, cartStorageKey, expectedScope, promptpayEnabled, shopName, onClose, onPaid }: PaymentDialogProps) {
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [priceAccepted, setPriceAccepted] = useState(false);
  const quoteInput = JSON.stringify(checkoutInput);
  // biome-ignore lint/correctness/useExhaustiveDependencies: quoteVersion explicitly refreshes the same quote after rejection or retry.
  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError(null);
    setPriceAccepted(false);
    void quoteCheckoutAction(JSON.parse(quoteInput)).then((response) => {
      if (!active) return;
      if (!response.ok) { setQuoteError(response.message); return; }
      setQuote(response.quote);
      setPriceAccepted(response.quote.totalSatang === cartTotal);
    }).catch(() => { if (active) setQuoteError("ตรวจสอบราคาไม่สำเร็จ กรุณาลองใหม่"); });
    return () => { active = false; };
  }, [quoteInput, cartTotal, quoteVersion]);
  const lines = quote ? quote.lines.map((line, index) => ({ ...line, key: cartLines[index]?.key ?? String(index) })) : cartLines;
  const subtotalSatang = quote?.subtotalSatang ?? cartSubtotal;
  const discountSatang = quote?.discountSatang ?? cartDiscount;
  const totalSatang = quote?.totalSatang ?? cartTotal;
  const ready = quote !== null && priceAccepted;
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [promptPayRequestId, setPromptPayRequestId] = useState<string | null>(null);
  const [stockReserved, setStockReserved] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [pending, setPending] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGLineElement>(null);
  const attemptRef = useRef<CheckoutAttempt | null>(null);
  const submittingRef = useRef(false);
  const previousQuoteInput = useRef(quoteInput);
  useEffect(() => {
    if (previousQuoteInput.current === quoteInput) return;
    previousQuoteInput.current = quoteInput;
    attemptRef.current = null;
    setPromptPayRequestId(null);
    setStockReserved(false);
  }, [quoteInput]);
  const receivedSatang = parseBahtToSatang(cashInput.replace(/\.$/, "")) ?? 0;
  const changeSatang = receivedSatang - totalSatang;
  const shortBySatang = Math.max(0, -changeSatang);
  const quickAmounts = useMemo(() => suggestCashAmounts(totalSatang), [totalSatang]);

  const reservePromptPay = useCallback(async (requestId: string) => {
    const result = await reservePromptPayStockAction({
      ...checkoutInput,
      requestId,
      expectedTotalSatang: totalSatang,
      payment: { method: "promptpay" },
      expectedScope,
    });
    if (!result.ok) throw new Error(result.message);
  }, [checkoutInput, expectedScope, totalSatang]);

  const releasePromptPay = useCallback(() => {
    if (!promptPayRequestId || !stockReserved) return;
    setStockReserved(false);
    void releasePromptPayStockAction(promptPayRequestId);
  }, [promptPayRequestId, stockReserved]);

  async function selectPromptPay() {
    if (!promptpayEnabled || !ready || pending) return;
    setError(null);
    setStockReserved(false);
    const requestId = promptPayRequestId ?? crypto.randomUUID();
    setPromptPayRequestId(requestId);
    try {
      await reservePromptPay(requestId);
      setStockReserved(true);
      setMethod("promptpay");
    } catch (reservationError) {
      setMethod("promptpay");
      setError(reservationError instanceof Error ? reservationError.message : "จองวัตถุดิบไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  useEffect(() => {
    if (method !== "promptpay" || !promptPayRequestId || !stockReserved) return;
    const timer = window.setInterval(() => {
      void reservePromptPay(promptPayRequestId).catch((reservationError: unknown) => {
        setStockReserved(false);
        setError(reservationError instanceof Error ? reservationError.message : "ต่อเวลาจองวัตถุดิบไม่สำเร็จ กรุณาตรวจสอบก่อนรับเงิน");
      });
    }, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [method, promptPayRequestId, reservePromptPay, stockReserved]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: "power1.out" });
    gsap.fromTo(dialogRef.current, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
  }, { scope: rootRef });

  useGSAP(() => {
    if (!indicatorRef.current) return;
    if (prefersReducedMotion()) { gsap.set(indicatorRef.current, { xPercent: method === "cash" ? 0 : 100 }); return; }
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
    if (closing || pending || recovering) return;
    releasePromptPay();
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
  }, [animateClose, closing, onClose, pending, recovering, releasePromptPay]);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, requestClose]);

  async function confirm() {
    if (!ready || submittingRef.current || (method === "cash" && receivedSatang < totalSatang)) return;
    submittingRef.current = true;
    setPending(true);
    setError(null);
    const payment: CheckoutInput["payment"] = method === "cash"
      ? { method: "cash", cashReceivedSatang: receivedSatang }
      : { method: "promptpay" };
    try {
      const input = { ...checkoutInput, expectedTotalSatang: totalSatang, payment };
      const attempt = checkoutAttempt(input, attemptRef.current);
      if (promptPayRequestId) attempt.requestId = promptPayRequestId;
      attemptRef.current = attempt;
      const pendingInput = { ...input, requestId: attempt.requestId, expectedScope };
      const response = await submitBrowserCheckout(pendingInput, cartStorageKey, checkoutAction);
      if (response.kind !== "completed") {
        setError(response.message);
        if (response.kind === "uncertain") {
          setRecovering(true);
        } else if (response.kind === "rejected") {
          attemptRef.current = null;
          setRecovering(false);
          if (method === "promptpay") setStockReserved(false);
          setQuoteVersion((version) => version + 1);
        }
        return;
      }
      attemptRef.current = null;
      onPaid(response.result, method);
    } catch {
      setRecovering(true);
      setError("ยังไม่ทราบผลการบันทึก กรุณาตรวจสอบรายการเดิมอีกครั้งก่อนรับออเดอร์ใหม่");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const isCash = method === "cash";
  const blocked = !ready || pending || (isCash && receivedSatang < totalSatang) || (!isCash && !stockReserved);
  const changeShort = shortBySatang > 0;

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(43,30,22,0.55)] p-3 sm:p-6">
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the dialog container owns the keyboard focus trap. */}
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-busy={pending} aria-labelledby={`${id}-payment-title`} onKeyDown={trapDialogTab}
        className="flex max-h-[calc(100dvh-24px)] flex-col overflow-y-auto md:h-[min(680px,calc(100dvh-24px))] md:flex-row w-full max-w-[1000px] md:overflow-hidden rounded-[24px] border border-white/60 bg-[#FFFFFF] shadow-[0_24px_80px_rgba(43,30,22,0.25)] outline-none">
        <aside className="flex w-full shrink-0 md:w-[36%] md:min-w-[260px] flex-col gap-3 bg-gradient-to-b from-[#F7F0E7] to-[#F0E4D7] p-4 md:p-7">
        <h2 id={`${id}-payment-title`} className="text-base text-[#817668]">ออเดอร์ {orderLabel}</h2>
          <div className="max-h-32 space-y-3 overflow-y-auto md:max-h-none md:min-h-0">
            {lines.map((line) => (
              <div key={line.key} className="flex justify-between gap-2 text-base">
                <div className="min-w-0"><div>{line.qty} × {line.name}</div>
                  {line.modifiersText && <div className="text-sm text-[#817668]">{line.modifiersText}</div>}
                </div>
                <span className="shrink-0 tabular-nums">{formatBaht(line.lineTotalSatang)}</span>
              </div>
            ))}
          </div>
          {discountSatang > 0 && <div className="flex justify-between text-base font-semibold text-[#2F6B3F]">
            <span>รางวัลสมาชิก</span><span className="tabular-nums">−{formatBaht(discountSatang)}</span>
          </div>}
          <div className="mt-auto border-t border-[#E0CFBD] pt-3">
            <div className="flex justify-between text-sm text-[#817668]"><span>รวม</span><span className="tabular-nums">{formatBaht(subtotalSatang)}</span></div>
            <div className="mt-1 text-lg font-semibold">ยอดชำระ</div>
            <div className="text-[clamp(40px,5vw,56px)] font-bold leading-[1.1] tabular-nums">{formatBaht(totalSatang)}</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4 md:overflow-y-auto p-6 sm:p-7">
          {!quote && <div role="status">{quoteError ?? "กำลังตรวจสอบราคาปัจจุบัน…"}{quoteError && <button type="button" className="ml-3 underline" onClick={() => setQuoteVersion((version) => version + 1)}>ลองใหม่</button>}</div>}
          {quote && !priceAccepted && <div role="alert" className="rounded-xl bg-amber-100 p-3">ราคาเปลี่ยนจาก {formatBaht(cartTotal)} เป็น {formatBaht(totalSatang)} กรุณาตรวจสอบรายการ
            <button type="button" className="mt-2 block min-h-11 font-bold underline" onClick={() => setPriceAccepted(true)}>ยืนยันยอดใหม่</button>
          </div>}
          <fieldset disabled={!ready || pending || recovering} className="contents">
          <legend className="sr-only">วิธีชำระและจำนวนเงินที่รับ</legend>
          <div role="tablist" aria-label="วิธีชำระ" className="relative grid grid-cols-2 rounded-[18px] bg-[#F1E7DC] p-1.5">
            <span ref={indicatorRef} aria-hidden="true" className="absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-[14px] bg-[#4A2C1A] shadow-sm" />
            <button type="button" role="tab" aria-selected={isCash} onClick={() => { releasePromptPay(); setMethod("cash"); setError(null); }}
              className={`relative z-10 h-[60px] rounded-[14px] text-lg font-bold transition-colors ${isCash ? "text-[#F7F1E7]" : "text-[#4A2C1A]"}`}>เงินสด</button>
            <button type="button" role="tab" aria-selected={!isCash} disabled={!promptpayEnabled}
              onClick={() => void selectPromptPay()}
              className={`relative z-10 h-[60px] rounded-[14px] text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:text-[#8A796B] ${isCash ? "text-[#4A2C1A]" : "text-[#F7F1E7]"}`}>พร้อมเพย์</button>
          </div>
          {!promptpayEnabled && <p className="-mt-3 text-sm text-[#817668]">ยังไม่ได้ตั้งค่าพร้อมเพย์ในหลังร้าน</p>}

          <div ref={contentRef} className="flex shrink-0 flex-col">
            {isCash ? <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="rounded-2xl border border-[#E2D8C7] bg-white/60 px-4 py-2.5 shadow-[0_2px_8px_rgba(74,44,26,0.04)]">
                  <div className="text-sm text-[#817668]">รับเงินมา</div>
                  <input aria-label="จำนวนเงินที่รับ (บาท)" inputMode="decimal" value={cashInput} placeholder="0" className="w-full min-w-0 bg-transparent text-[40px] font-bold leading-tight tabular-nums" onChange={(event) => { const value = event.target.value; if (/^\d{0,6}(\.\d{0,2})?$/.test(value)) setCashInput(value); }} />
                </div>
                <div className={`rounded-2xl border px-4 py-2.5 transition-colors duration-200 ${changeShort ? "border-[#E9B29B] bg-[#F7DCD0] text-[#8E3415]" : "border-[#BDD3C0] bg-[#E7F1E8] text-[#245232]"}`}>
                  <div className="text-sm">เงินทอน</div>
                  <div className="text-[34px] font-bold leading-tight tabular-nums">{changeShort ? `ขาดอีก ${formatBaht(shortBySatang)}` : <AnimatedBaht satang={changeSatang} />}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickAmounts.map((amount, index) => <button key={amount} type="button"
                    className="h-[52px] rounded-[14px] border border-[#E2D8C7] bg-[#FFFFFF] text-base font-bold shadow-[0_2px_5px_rgba(74,44,26,0.04)] transition-colors active:bg-[#F3E8DC]"
                    onClick={() => setCashInput(String(amount))}>{index === 0 ? "พอดี" : formatBaht(amount * 100)}</button>)}
                </div>
              </div>
              <Keypad value={cashInput} onChange={(next) => setCashInput(next.replace(/^0+(?=\d)/, ""))} maxLength={9} decimal
                className="w-full sm:w-[min(280px,43%)] content-start" keyClassName="h-[min(72px,9vh)] min-h-[50px]" />
            </div> : ready && stockReserved ? <PromptPayQr amountSatang={totalSatang} shopName={shopName} />
              : ready && !error ? <p className="rounded-xl bg-amber-100 p-3" role="status">กำลังตรวจสอบและจองวัตถุดิบก่อนแสดง QR…</p> : null}
          </div>

          </fieldset>
          <div className="flex shrink-0 gap-3">
            <button type="button" disabled={pending || closing || recovering} onClick={requestClose}
              className="h-[72px] w-20 shrink-0 sm:w-36 rounded-2xl border border-[#E2D8C7] bg-[#FFFFFF] text-lg font-semibold shadow-sm disabled:opacity-60">กลับ</button>
            <button type="button" disabled={blocked} onClick={() => void confirm()}
              className="relative h-[72px] min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#2F6B3F] px-3 text-lg font-bold text-white shadow-[0_7px_16px_rgba(47,107,63,0.18)] transition-colors disabled:bg-[#D1C1A8]">
              {pending && <svg className="absolute inset-x-4 bottom-0 h-1.5 w-[calc(100%-2rem)]" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><line ref={progressRef} x1="0" y1="2" x2="100" y2="2" stroke="#D7E8D9" strokeWidth="3" strokeLinecap="round" /></svg>}
              {pending ? "กำลังบันทึก…" : recovering ? "ตรวจสอบรายการเดิมอีกครั้ง" : isCash ? (shortBySatang ? "ใส่จำนวนเงินที่รับ" : `รับเงิน · ทอน ${formatBaht(changeSatang)}`) : "ได้รับเงินแล้ว"}
            </button>
          </div>
          {error && <p className="-mt-3 text-sm font-semibold text-[#8E3415]" role="alert">{error}</p>}
        </section>
      </div>
    </div>
  );
}
