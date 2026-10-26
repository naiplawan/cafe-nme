"use client";

import { useCallback, useEffect, useRef } from "react";
import { formatBaht } from "@/lib/money";
import type { OrderDetail } from "@/server/orders";
import Link from "next/link";

const receiptDateFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "short",
  timeStyle: "short",
});

function formatReceiptDate(date: Date | null) {
  if (!date) return "—";
  return receiptDateFormat.format(date);
}

export function ReceiptView({ order, logoUrl }: { order: OrderDetail; logoUrl: string | null }) {
  const printed = useRef(false);
  const logoRef = useRef<HTMLImageElement>(null);

  const printOnce = useCallback(() => {
    if (printed.current) return;
    printed.current = true;
    window.print();
  }, []);

  useEffect(() => {
    if (!logoUrl || logoRef.current?.complete) printOnce();
  }, [logoUrl, printOnce]);

  return <>
    <style>{`@page { size: 58mm auto; margin: 0; }
      @media print {
        html, body { box-sizing: border-box; width: 58mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
        .receipt-screen { display: block !important; box-sizing: border-box; width: 58mm !important; min-height: 0 !important; padding: 0 !important; background: #fff !important; }
        .receipt-paper { box-sizing: border-box !important; width: 58mm !important; max-width: none !important; padding: 3.5mm !important; border: 0 !important; box-shadow: none !important; break-inside: avoid; }
        .no-print { display: none !important; }
      }`}</style>
    <main className="receipt-screen flex min-h-dvh flex-col items-center bg-[#F7F1E7] px-3 py-5 text-[#4A2C1A]">
      <Link href="/pos/orders" className="no-print mb-4 flex h-11 items-center rounded-xl bg-[#4A2C1A] px-5 text-sm font-semibold text-white no-underline">กลับ</Link>
      <article className="receipt-paper w-[58mm] max-w-full rounded-xl border border-[#E2D8C7] bg-white px-[3.5mm] py-[4mm] text-[12px] leading-[1.45] shadow-[0_10px_30px_rgba(59,42,32,0.08)]">
        <header className="text-center">
          {logoUrl ? <>
            {/* eslint-disable-next-line @next/next/no-img-element -- wait for the thermal receipt logo before printing */}
            <img ref={logoRef} src={logoUrl} alt="" width={64} height={64} onLoad={printOnce} onError={printOnce} className="mx-auto mb-1 block object-contain"
              style={{ width: "16mm", height: "16mm", filter: "grayscale(1) contrast(1.2)" }} />
          </> : null}
          <h1 className="m-0 text-[16px] font-bold">{order.shopName}</h1>
          <p className="mb-0 mt-1">ใบเสร็จรับเงิน</p>
        </header>
        <div className="my-3 border-t border-dashed border-[#817668]" />
        <div className="flex justify-between gap-2"><span>เลขที่บิล</span><span className="tabular-nums">{`#${String(order.dailyNo).padStart(3, "0")}`}</span></div>
        <div className="flex justify-between gap-2"><span>วันที่</span><span className="text-right tabular-nums">{formatReceiptDate(order.paidAt)}</span></div>
        {order.staffName ? <div className="flex justify-between gap-2"><span>พนักงาน</span><span>{order.staffName}</span></div> : null}
        {order.status === "void" ? <p className="mb-0 mt-2 text-center font-bold text-[#8E3415]">ยกเลิกแล้ว</p> : null}
        <div className="my-3 border-t border-dashed border-[#817668]" />
        <div className="space-y-2">
          {order.items.map((item) => <div key={item.id}>
            <div className="flex justify-between gap-2"><span className="min-w-0 break-words">{item.name} × {item.qty}</span><span className="shrink-0 tabular-nums">{formatBaht(item.unitPriceSatang * item.qty)}</span></div>
            {item.modifiers.length ? <p className="m-0 pl-2 text-[11px] text-[#817668]">{item.modifiers.map((modifier) => modifier.name).join(" · ")}</p> : null}
            {item.note ? <p className="m-0 pl-2 text-[11px] text-[#817668]">หมายเหตุ: {item.note}</p> : null}
          </div>)}
        </div>
        <div className="my-3 border-t border-dashed border-[#817668]" />
        <div className="flex justify-between gap-2"><span>รวม</span><span className="tabular-nums">{formatBaht(order.subtotalSatang)}</span></div>
        {order.discountSatang > 0 ? <div className="flex justify-between gap-2"><span>ส่วนลด</span><span className="tabular-nums">-{formatBaht(order.discountSatang)}</span></div> : null}
        <div className="mt-1 flex justify-between gap-2 text-[14px] font-bold"><span>ยอดสุทธิ</span><span className="tabular-nums">{formatBaht(order.totalSatang)}</span></div>
        <div className="my-3 border-t border-dashed border-[#817668]" />
        <div className="flex justify-between gap-2"><span>ชำระด้วย</span><span>{order.paymentMethod === "cash" ? "เงินสด" : "พร้อมเพย์"}</span></div>
        {order.paymentMethod === "cash" && order.cashReceivedSatang !== null ? <>
          <div className="flex justify-between gap-2"><span>รับเงิน</span><span className="tabular-nums">{formatBaht(order.cashReceivedSatang)}</span></div>
          <div className="flex justify-between gap-2"><span>เงินทอน</span><span className="tabular-nums">{formatBaht(order.cashReceivedSatang - order.totalSatang)}</span></div>
        </> : null}
        <div className="my-3 border-t border-dashed border-[#817668]" />
        <p className="m-0 whitespace-pre-wrap text-center">{order.receiptFooter || "ขอบคุณที่ใช้บริการ"}</p>
        <p className="mb-0 mt-2 text-center text-[11px]">ไม่ใช่ใบกำกับภาษี</p>
      </article>
    </main>
  </>;
}
