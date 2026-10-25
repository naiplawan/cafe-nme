"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, ListOrdered, LogOut, QrCode, Wallet } from "lucide-react";
import { logoutPos } from "@/app/pos/actions";
import { BrandLogo } from "@/components/brand/brand";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION } from "@/components/motion/gsap";
import { thaiInitial } from "@/lib/thai";

type PosHeaderProps = {
  shopName: string;
  orderNo: number;
  staffName: string;
  staffRole: string;
  online: boolean;
  logoUrl: string | null;
};

export function PosHeader({ shopName, orderNo, staffName, staffRole, online, logoUrl }: PosHeaderProps) {
  const [pending, startTransition] = useTransition();
  const headerRef = useRef<HTMLElement>(null);
  useGSAP(() => {
    const dot = headerRef.current?.querySelector<HTMLElement>("[data-network-dot]");
    const pill = headerRef.current?.querySelector<HTMLElement>("[data-network-pill]");
    if (!dot || !pill) return;
    const media = gsap.matchMedia();
    if (online) gsap.set(pill, { x: 0, opacity: 1 });
    else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.set(pill, { x: 0, opacity: 1 });
      else gsap.fromTo(pill, { x: 12, opacity: 0 }, { x: 0, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(dot, { scale: 1.16, opacity: 0.7, duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
    return () => media.revert();
  }, { scope: headerRef, dependencies: [online] });

  return (
    <header ref={headerRef} className="flex min-h-[68px] shrink-0 flex-wrap lg:flex-nowrap items-center gap-2 py-2 lg:gap-2 lg:py-0 bg-[#3B2A20] px-5 text-[#F5EDE3]">
      <BrandLogo logoUrl={logoUrl} size={40} className="rounded-[10px]" />
      <div className="flex min-w-0 lg:max-w-40 flex-col leading-tight">
        <span className="truncate text-lg font-bold">{shopName}</span>
        <span className="text-[13px] text-[#E9D9C6]">แท็บเล็ตหน้าร้าน</span>
      </div>
      <div className="ml-2 shrink-0 whitespace-nowrap rounded-full bg-[#574235] px-3.5 py-1.5 text-base font-semibold">ออเดอร์ #{String(orderNo).padStart(3, "0")}</div>
      <div data-network-pill aria-live="polite" className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${online ? "text-[#E9D9C6]" : "bg-[#F7DCD0] text-[#8E3415]"}`}>
        <span data-network-dot className={`size-2.5 rounded-full ${online ? "bg-[#6FCF8E]" : "bg-[#B4441C]"}`} />
        {online ? "ออนไลน์" : "ออฟไลน์ — ชำระเงินไม่ได้"}
      </div>
      <div className="flex w-full max-w-full flex-wrap lg:flex-nowrap items-center gap-2 sm:ml-auto sm:w-auto">
        <Link href="/pos/requests" aria-label="คำสั่งจาก QR" title="คำสั่งจาก QR" className="flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#574235] px-3 text-sm font-semibold"><QrCode aria-hidden="true" size={20} /><span className="hidden xl:inline">จาก QR</span></Link>
        <Link href="/pos/queue" aria-label="คิวเครื่องดื่ม" title="คิวเครื่องดื่ม" className="flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#574235] px-3 text-sm font-semibold"><ListOrdered aria-hidden="true" size={20} /><span className="hidden xl:inline">คิว</span></Link>
        <Link href="/pos/shifts" aria-label="กะเงินสด" title="กะเงินสด" className="flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#574235] px-3 text-sm font-semibold"><Wallet aria-hidden="true" size={20} /><span className="hidden xl:inline">กะเงินสด</span></Link>
        <Link href="/pos/orders" aria-label="ออเดอร์วันนี้" title="ออเดอร์วันนี้" className="flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#574235] px-3 text-sm font-semibold text-[#F5EDE3]">
          <ClipboardList aria-hidden="true" size={20} /><span className="hidden xl:inline">วันนี้</span>
        </Link>
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#574235] px-2 sm:flex-none sm:max-w-40 sm:gap-2 sm:px-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#C69C72] font-bold text-[#3B2A20]">{thaiInitial(staffName)}</span>
          <span className="min-w-0 truncate text-[13px] leading-tight sm:text-[15px]">{staffName}<br /><span className="text-xs text-[#E9D9C6]">{staffRole}</span></span>
        </div>
        <button type="button" aria-label="ออกจากระบบ" disabled={pending} onClick={() => { startTransition(async () => { await logoutPos(); }); }}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#574235] disabled:opacity-60">
          <LogOut aria-hidden="true" size={22} />
        </button>
      </div>
    </header>
  );
}
