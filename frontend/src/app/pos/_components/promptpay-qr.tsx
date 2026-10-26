"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { formatBaht } from "@/lib/money";
import { promptPayQr } from "@/app/pos/checkout-actions";

type PromptPayQrProps = { amountSatang: number; shopName: string };

export function PromptPayQr({ amountSatang, shopName }: PromptPayQrProps) {
  const [response, setResponse] = useState<{ amountSatang: number; svg?: string; error?: string } | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    let current = true;
    void promptPayQr(amountSatang).then((result) => {
      if (!current) return;
      if ("error" in result) setResponse({ amountSatang, error: result.error });
      else if (result.svg.trimStart().startsWith("<svg")) setResponse({ amountSatang, svg: result.svg });
      else setResponse({ amountSatang, error: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" });
    }).catch(() => {
      if (current) setResponse({ amountSatang, error: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" });
    });
    return () => { current = false; };
  }, [amountSatang]);

  const svg = response?.amountSatang === amountSatang ? response.svg : null;
  const error = response?.amountSatang === amountSatang ? response.error : null;

  useGSAP(() => {
    if (!svg) return;
    if (prefersReducedMotion()) {
      if (maskRef.current) gsap.set(maskRef.current, { scaleX: 0 });
      if (frameRef.current) gsap.set(frameRef.current, { drawSVG: "100%" });
      return;
    }
    const timeline = gsap.timeline();
    timeline.fromTo(maskRef.current, { scaleX: 1 }, { scaleX: 0, duration: MOTION.base, ease: "power2.inOut" }, 0);
    timeline.fromTo(frameRef.current, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: "power2.out" }, 0.04);
  }, { scope: qrRef, dependencies: [svg], revertOnUpdate: true });

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
      <div ref={qrRef} className={`relative flex size-[292px] max-h-[40vh] max-w-full items-center justify-center rounded-[20px] border bg-white p-4 shadow-[0_8px_28px_rgba(59,42,32,0.08)] ${error ? "border-[#E9B29B] bg-[#FFF9F5]" : "border-[#E2D8C7]"}`}>
        {svg ? <>
          <Image src={`data:image/svg+xml,${encodeURIComponent(svg)}`} alt="QR พร้อมเพย์" width={260} height={260} unoptimized className="h-full max-h-full w-full max-w-full" />
          <span ref={maskRef} aria-hidden="true" className="absolute inset-4 z-10 origin-right bg-white" />
          <svg className="pointer-events-none absolute inset-2 size-[calc(100%-1rem)]" viewBox="0 0 260 260" fill="none" aria-hidden="true">
            <rect ref={frameRef} x="1.5" y="1.5" width="257" height="257" rx="14" stroke="#F4B942" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </> : error ? (
          <div className="flex flex-col items-center gap-2 px-5" role="alert">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F7DCD0] text-lg font-bold text-[#8E3415]">!</span>
            <p className="text-sm font-semibold text-[#8E3415]">{error}</p>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 rounded-[14px] bg-[#FCFAF7]" role="status" aria-label="กำลังสร้าง QR พร้อมเพย์">
            <div className="grid size-[194px] grid-cols-4 gap-2 opacity-70" aria-hidden="true">
              <span className="col-span-2 row-span-2 rounded-md bg-[#E2D8C7]" />
              <span className="rounded-md bg-[#F7F1E7]" /><span className="rounded-md bg-[#E2D8C7]" />
              <span className="rounded-md bg-[#E2D8C7]" /><span className="rounded-md bg-[#F7F1E7]" />
              <span className="col-span-2 rounded-md bg-[#E2D8C7]" />
            </div>
            <span className="text-sm text-[#6B5E55]">กำลังสร้าง QR พร้อมเพย์…</span>
          </div>
        )}
      </div>
      <p className="font-semibold text-[#4A2C1A]">สแกนจ่าย {formatBaht(amountSatang)} · {shopName}</p>
      <p className="text-sm text-[#6B5E55]">ตรวจยอดเงินเข้าในแอปธนาคาร แล้วกด “ได้รับเงินแล้ว”</p>
    </div>
  );
}
