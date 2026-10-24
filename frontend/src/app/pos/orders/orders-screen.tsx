"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { formatBaht } from "@/lib/money";
import { gsap, MOTION, useGSAP } from "@/components/motion/gsap";
import type { OrderDetail, OrderSummary } from "@/server/orders";
import { Keypad } from "@/app/pos/_components/keypad";
import { TodaySummary } from "./today-summary";
import { formatOrderTime } from "./format";
import { getOrderAction, voidOrderAction } from "./actions";
import { trapDialogTab } from "@/lib/dialog-focus";

function orderTimestamp(date: Date | null) {
  return date ? formatOrderTime(date) : "—";
}

type Props = {
  orders: OrderSummary[];
  initialDetail: OrderDetail | null;
  netSalesSatang: number;
  todaySummary: { orders: number; netSatang: number; cups: number; byMethod: { cash: number; promptpay: number } };
  hourlySales: { hour: number; orders: number; netSatang: number }[];
  topItems: { name: string; qty: number }[];
  currentHour: number;
};

function orderLabel(dailyNo: number) {
  return `#${String(dailyNo).padStart(3, "0")}`;
}

function methodLabel(method: OrderSummary["paymentMethod"]) {
  if (method === "cash") return "เงินสด";
  if (method === "promptpay") return "พร้อมเพย์";
  return "ยังไม่ชำระ";
}

function statusClass(status: OrderSummary["status"]) {
  return status === "void" ? "bg-[#F7DCD0] text-[#8E3415]" : "bg-[#E7F1E8] text-[#245232]";
}

export function OrdersScreen({ orders, initialDetail, netSalesSatang, todaySummary, hourlySales, topItems, currentHour }: Props) {
  const voidTitleId = useId();
  const router = useRouter();
  const [view, setView] = useState<"orders" | "summary">("orders");
  const [selectedId, setSelectedId] = useState(initialDetail?.id ?? null);
  const [detail, setDetail] = useState<OrderDetail | null>(initialDetail);
  const detailRequest = useRef(0);
  const voidInFlight = useRef(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [pin, setPin] = useState("");
  const [voidMessage, setVoidMessage] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [dialogClosing, setDialogClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogOverlayRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const orderListRef = useRef<HTMLElement>(null);
  const selectionMarkerRef = useRef<HTMLSpanElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const pinDotsRef = useRef<HTMLDivElement>(null);
  const previousPinLengthRef = useRef(0);
  const { contextSafe } = useGSAP({ scope: screenRef });

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-order-item]", { opacity: 0, y: 8, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: screenRef, dependencies: [orders.length], revertOnUpdate: true });

  useGSAP(() => {
    const list = orderListRef.current;
    const marker = selectionMarkerRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-order-id="${selectedId}"]`);
    if (!item || !marker) return;
    const y = item.offsetTop;
    const scaleY = item.offsetHeight / 76;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.killTweensOf(marker);
      gsap.to(marker, { y, scaleY, duration: MOTION.base, ease: MOTION.ease });
    });
    media.add("(prefers-reduced-motion: reduce)", () => gsap.set(marker, { y, scaleY }));
    return () => media.revert();
  }, { scope: screenRef, dependencies: [selectedId, orders.length] });

  useGSAP(() => {
    if (!detail) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(detailsRef.current, { opacity: 0.55, y: 5 }, { opacity: 1, y: 0, duration: MOTION.base, ease: MOTION.ease });
      if (detail.status === "void") {
        gsap.fromTo("[data-void-status]", { scale: 0.88 }, { scale: 1, duration: MOTION.fast, ease: MOTION.pop });
        gsap.fromTo("[data-void-total] path", { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: MOTION.ease });
      }
    });
    return () => media.revert();
  }, { scope: screenRef, dependencies: [selectedId, detail?.id, detail?.status, loadingDetail], revertOnUpdate: true });

  useGSAP(() => {
    if (pin.length > previousPinLengthRef.current) {
      const lastDot = pinDotsRef.current?.querySelector(`[data-pin-index="${pin.length - 1}"]`);
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        if (lastDot) gsap.fromTo(lastDot, { scale: 0.45 }, { scale: 1, duration: MOTION.fast, ease: MOTION.pop });
      });
      previousPinLengthRef.current = pin.length;
      return () => media.revert();
    }
    previousPinLengthRef.current = pin.length;
  }, { scope: screenRef, dependencies: [pin.length], revertOnUpdate: true });

  useGSAP(() => {
    if (!voidMessage) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(pinDotsRef.current, { x: -7 }, { x: 7, duration: 0.045, repeat: 3, yoyo: true, ease: "power1.inOut", onComplete: () => gsap.set(pinDotsRef.current, { x: 0 }) });
      gsap.fromTo("[data-void-error]", { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: screenRef, dependencies: [voidMessage], revertOnUpdate: true });

  useGSAP(() => {
    if (!showVoid) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(dialogOverlayRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
      gsap.fromTo(dialogRef.current, { opacity: 0, scale: 0.97, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: screenRef, dependencies: [showVoid], revertOnUpdate: true });

  useGSAP(() => {
    if (!dialogClosing) return;
    gsap.set(dialogOverlayRef.current, { pointerEvents: "none" });
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(dialogOverlayRef.current, { opacity: 0, duration: MOTION.fast, ease: MOTION.easeIn });
      gsap.to(dialogRef.current, { opacity: 0, scale: 0.98, y: 5, duration: MOTION.fast, ease: MOTION.easeIn, onComplete: () => setShowVoid(false) });
    });
    media.add("(prefers-reduced-motion: reduce)", () => setShowVoid(false));
    return () => media.revert();
  }, { scope: screenRef, dependencies: [dialogClosing], revertOnUpdate: true });

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      orders.forEach((order) => {
        if (order.status !== "void") return;
        gsap.fromTo(`[data-order-id="${order.id}"] [data-list-status]`, { scale: 0.88 }, { scale: 1, duration: MOTION.fast, ease: MOTION.pop });
        gsap.fromTo(`[data-order-id="${order.id}"] [data-list-total] path`, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: MOTION.ease });
      });
    });
    return () => media.revert();
  }, { scope: screenRef, dependencies: [orders.map((order) => `${order.id}:${order.status}`).join(",")], revertOnUpdate: true });

  const closeVoid = contextSafe(() => {
    if (voiding) return;
    setDialogClosing(true);
  });

  useEffect(() => {
    if (!showVoid) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeVoid();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showVoid, closeVoid]);

  async function selectOrder(orderId: string) {
    const request = ++detailRequest.current;
    setSelectedId(orderId);
    setDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
    try {
      const next = await getOrderAction(orderId);
      if (request !== detailRequest.current) return;
      setDetail(next);
      if (!next) setDetailError("ไม่พบออเดอร์นี้");
    } catch {
      if (request === detailRequest.current) setDetailError("โหลดรายละเอียดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (request === detailRequest.current) setLoadingDetail(false);
    }
  }

  function openVoid() {
    setPin("");
    setVoidMessage(null);
    setDialogClosing(false);
    setShowVoid(true);
  }

  async function confirmVoid() {
    if (!detail || detail.id !== selectedId || loadingDetail || pin.length < 4 || voidInFlight.current) return;
    voidInFlight.current = true;
    setVoiding(true);
    setVoidMessage(null);
    try {
      const result = await voidOrderAction(detail.id, pin);
      if (!result.ok) { setVoidMessage(result.message); setPin(""); return; }
      setShowVoid(false);
      await selectOrder(detail.id);
      router.refresh();
    } catch {
      setVoidMessage("ยังยืนยันผลการยกเลิกไม่ได้ กรุณาลองตรวจสอบบิลเดิมอีกครั้ง");
      setPin("");
    } finally {
      voidInFlight.current = false;
      setVoiding(false);
    }
  }

  const voidCount = orders.filter((order) => order.status === "void").length;

  return <main ref={screenRef} className="relative flex min-h-dvh flex-col overflow-hidden bg-[#F5EDE3] text-[#3B2A20]">
    <header className="flex min-h-[68px] shrink-0 items-center gap-4 bg-[#3B2A20] px-5 text-[#F5EDE3] max-[850px]:flex-wrap max-[850px]:py-3">
      <Link href="/pos" className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#574235] px-[18px] text-base font-semibold text-[#F5EDE3] no-underline">
        <ArrowLeft aria-hidden="true" size={20} /> กลับหน้าขาย
      </Link>
      <h1 className="m-0 text-[22px] font-bold">ออเดอร์วันนี้</h1>
      <fieldset className="flex h-12 shrink-0 rounded-xl bg-[#574235] p-1"><legend className="sr-only">เลือกมุมมอง</legend>
        <button type="button" aria-pressed={view === "orders"} onClick={() => setView("orders")} className={`min-w-[92px] rounded-lg px-3 text-sm font-semibold ${view === "orders" ? "bg-[#F5EDE3] text-[#3B2A20]" : "text-[#F5EDE3]"}`}>ออเดอร์</button>
        <button type="button" aria-pressed={view === "summary"} onClick={() => setView("summary")} className={`min-w-[92px] rounded-lg px-3 text-sm font-semibold ${view === "summary" ? "bg-[#F5EDE3] text-[#3B2A20]" : "text-[#F5EDE3]"}`}>สรุปยอด</button>
      </fieldset>
      <div className="ml-auto flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-[#E9D9C6] max-[850px]:ml-0">
        <span>ยอดขาย <b className="text-lg tabular-nums text-[#F5EDE3]">{formatBaht(netSalesSatang)}</b></span>
        <span>{orders.length} บิล</span>
        <span>ยกเลิก {voidCount}</span>
      </div>
    </header>

    {view === "orders" ? <div className="flex min-h-0 flex-1 max-[760px]:flex-col">
      <section ref={orderListRef} aria-label="รายการออเดอร์" className="relative flex w-[min(520px,42vw)] shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#E4D6C6] p-3 max-[760px]:w-full max-[760px]:border-r-0 max-[760px]:border-b">
        {selectedId ? <span ref={selectionMarkerRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-[1] h-[76px] w-[3px] origin-top rounded-r-full bg-[#B4441C] shadow-[0_0_10px_rgba(180,68,28,0.25)]" /> : null}
        {orders.length ? orders.map((order) => {
          const isSelected = selectedId === order.id;
          return <button key={order.id} data-order-item data-order-id={order.id} type="button" aria-pressed={isSelected} onClick={() => void selectOrder(order.id)}
            className={`relative flex min-h-[76px] items-center gap-3.5 rounded-2xl border px-4 py-3 text-left text-[#3B2A20] transition-colors ${isSelected ? "border-[#3B2A20] bg-[#FFFBF6] shadow-[0_6px_18px_rgba(59,42,32,0.06)]" : "border-[#E4D6C6] bg-[#FBF5EE]"}`}>
            <span className="w-[72px] shrink-0 text-[22px] font-bold">{orderLabel(order.dailyNo)}</span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="text-base font-semibold">{orderTimestamp(order.paidAt)} · {order.itemCount} รายการ</span><br />
              <span className="text-sm text-[#6B5547]">{methodLabel(order.paymentMethod)} · {order.memberName ?? "ไม่ใช่สมาชิก"}</span>
            </span>
            <span className="text-right leading-snug">
              <span className="relative inline-block whitespace-nowrap text-lg font-bold tabular-nums">{formatBaht(order.totalSatang)}{order.status === "void" ? <svg data-list-total aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-2 w-full -translate-y-1/2" viewBox="0 0 100 8" preserveAspectRatio="none"><path d="M2 4H98" fill="none" stroke="#B4441C" strokeWidth="2.5" strokeLinecap="round" /></svg> : null}</span><br />
              <span data-list-status className={`inline-block rounded-full px-2 py-0.5 text-[13px] font-semibold ${statusClass(order.status)}`}>{order.status === "void" ? "ยกเลิกแล้ว" : "ชำระแล้ว"}</span>
            </span>
          </button>;
        }) : <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Image src="/assets/empty-orders.png" alt="" width={128} height={128} className="size-32 object-contain" />
          <p className="m-0 text-xl font-semibold">วันนี้ยังไม่มีออเดอร์</p>
          <p className="m-0 text-[#6B5547]">รายการขายจะแสดงที่นี่</p>
        </div>}
      </section>

      <section ref={detailsRef} aria-label="รายละเอียดออเดอร์" className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#FFFBF6] px-8 py-7 max-[760px]:min-h-[420px] max-[760px]:px-5">
        {detailError && <div role="alert">{detailError}<button type="button" className="ml-3 min-h-11 underline" onClick={() => { if (selectedId) void selectOrder(selectedId); }}>ลองใหม่</button></div>}
        {detail && detail.id === selectedId && !loadingDetail ? <>
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2">
            <span className="text-[40px] font-bold">{orderLabel(detail.dailyNo)}</span>
            <span className="text-base text-[#6B5547]">{orderTimestamp(detail.paidAt ?? detail.voidedAt)} · โดย {detail.staffName ?? "—"}</span>
            <span data-void-status className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold ${statusClass(detail.status)}`}>{detail.status === "void" ? "ยกเลิกแล้ว" : "ชำระแล้ว"}</span>
          </div>
          {loadingDetail ? <p className="text-[#6B5547]">กำลังโหลดรายละเอียด…</p> : <>
            <div className="flex flex-col border-t border-[#E4D6C6]">
              {detail.items.map((item) => <div key={item.id} className="flex gap-3 border-b border-[#EFE3D5] py-3 text-[17px]">
                <span className="w-10 shrink-0 font-bold">{item.qty}×</span>
                <span className="min-w-0 flex-1">{item.name}
                  {item.modifiers.length || item.note ? <span className="block text-sm text-[#6B5547]">{[...item.modifiers.map((modifier) => modifier.name), item.note].filter(Boolean).join(" · ")}</span> : null}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatBaht(item.unitPriceSatang * item.qty)}</span>
              </div>)}
            </div>
            <div className="flex justify-between text-base text-[#6B5547]"><span>ชำระด้วย</span><span>{methodLabel(detail.paymentMethod)}</span></div>
            <div className="flex justify-between text-base text-[#6B5547]"><span>สมาชิก</span><span>{detail.memberName ?? "ไม่ใช่สมาชิก"}</span></div>
            {detail.discountSatang > 0 ? <div className="flex justify-between text-base text-[#6B5547]"><span>ส่วนลด</span><span>-{formatBaht(detail.discountSatang)}</span></div> : null}
            {detail.paymentMethod === "cash" && detail.cashReceivedSatang !== null ? <div className="flex justify-between text-sm text-[#6B5547]"><span>รับเงินสด · เงินทอน</span><span className="tabular-nums">{formatBaht(detail.cashReceivedSatang)} · {formatBaht(detail.cashReceivedSatang - detail.totalSatang)}</span></div> : null}
            <div className="flex items-baseline justify-between"><span className="text-lg font-semibold">ยอดรวม</span><span className="relative inline-block text-[34px] font-bold tabular-nums">{formatBaht(detail.totalSatang)}{detail.status === "void" ? <svg data-void-total aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-2 w-full -translate-y-1/2" viewBox="0 0 100 8" preserveAspectRatio="none"><path d="M2 4H98" fill="none" stroke="#B4441C" strokeWidth="2.5" strokeLinecap="round" /></svg> : null}</span></div>
          </>}
          <div className="mt-auto flex gap-3 pt-2 max-[520px]:flex-col">
            <Link href={`/pos/receipt/${detail.id}`} className="flex h-[68px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] text-lg font-semibold text-[#3B2A20] no-underline">
              <Printer aria-hidden="true" size={22} /> พิมพ์ใบเสร็จซ้ำ
            </Link>
            {detail.status === "paid" ? <Link href={`/pos/refunds/${detail.id}`} className="flex min-h-12 items-center justify-center rounded-xl border px-4 font-semibold">คืนเงินบางรายการ</Link> : null}
            {detail.status === "paid" ? <button type="button" onClick={openVoid} className="h-[68px] flex-1 rounded-2xl border-2 border-[#8E3415] bg-[#FFFBF6] text-lg font-bold text-[#8E3415]">ยกเลิกบิลนี้</button> : null}
          </div>
        </> : orders.length ? <p className="m-auto text-center text-[#6B5547]">{loadingDetail ? "กำลังโหลดรายละเอียด…" : "เลือกออเดอร์เพื่อดูรายละเอียด"}</p> : <div className="m-auto text-center text-[#6B5547]">ยังไม่มีรายละเอียดออเดอร์</div>}
      </section>
    </div> : <TodaySummary summary={todaySummary} hourlySales={hourlySales} topItems={topItems} currentHour={currentHour} />}

    {showVoid && detail ? <div ref={dialogOverlayRef} className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-[rgba(43,30,22,0.55)] p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={voidTitleId} tabIndex={-1} onKeyDown={trapDialogTab}
        className="flex w-full max-w-[520px] flex-col items-center gap-4 rounded-3xl bg-[#FFFBF6] p-7 outline-none">
        <h2 id={voidTitleId} className="m-0 text-center text-2xl font-bold">ยกเลิกบิล {orderLabel(detail.dailyNo)} ({formatBaht(detail.totalSatang)})</h2>
        <p className="m-0 text-center text-base text-[#6B5547]">ต้องใช้ PIN ผู้จัดการหรือเจ้าของร้าน · แสตมป์ที่ได้จากบิลนี้จะถูกหักคืน</p>
        <div ref={pinDotsRef} role="img" aria-label={`PIN ที่ใส่แล้ว ${pin.length} หลัก`} className="flex gap-3 py-1">
          {Array.from({ length: 6 }, (_, index) => index + 1).map((pinPosition) => <span key={pinPosition} data-pin-index={pinPosition - 1} className={`size-[22px] rounded-full border-2 border-[#3B2A20] ${pinPosition <= pin.length ? "bg-[#3B2A20]" : "bg-transparent"}`} />)}
        </div>
        <Keypad value={pin} onChange={(value) => { setPin(value); setVoidMessage(null); }} maxLength={6} keyClassName="h-[68px] rounded-[14px] text-[26px]" className="w-full gap-2.5" />
        {voidMessage ? <p data-void-error role="alert" className="m-0 text-center font-semibold text-[#8E3415]">{voidMessage}</p> : null}
        <div className="flex w-full gap-3 max-[420px]:flex-col">
          <button type="button" disabled={voiding} onClick={closeVoid} className="h-16 flex-1 rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] text-lg font-semibold text-[#3B2A20]">ไม่ยกเลิก</button>
          <button type="button" disabled={pin.length < 4 || voiding} onClick={() => void confirmVoid()} className="h-16 flex-1 rounded-2xl bg-[#8E3415] text-lg font-bold text-white disabled:bg-[#C9B6A4]">{voiding ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}</button>
        </div>
      </div>
    </div> : null}
  </main>;
}
