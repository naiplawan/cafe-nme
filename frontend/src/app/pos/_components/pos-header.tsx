"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, LogOut } from "lucide-react";
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
  onLogout: () => void;
};

export function PosHeader({ shopName, orderNo, staffName, staffRole, online, logoUrl, onLogout }: PosHeaderProps) {
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
    <header ref={headerRef} className="flex h-[68px] shrink-0 items-center gap-4 bg-[#3B2A20] px-5 text-[#F5EDE3]">
      <BrandLogo logoUrl={logoUrl} size={40} className="rounded-[10px]" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-lg font-bold">{shopName}</span>
        <span className="text-[13px] text-[#E9D9C6]">แท็บเล็ตหน้าร้าน</span>
      </div>
      <div className="ml-2 rounded-full bg-[#574235] px-3.5 py-1.5 text-base font-semibold">ออเดอร์ #{String(orderNo).padStart(3, "0")}</div>
      <div data-network-pill aria-live="polite" className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${online ? "text-[#E9D9C6]" : "bg-[#F7DCD0] text-[#8E3415]"}`}>
        <span data-network-dot className={`size-2.5 rounded-full ${online ? "bg-[#6FCF8E]" : "bg-[#B4441C]"}`} />
        {online ? "ออนไลน์" : "ออฟไลน์ — ชำระเงินไม่ได้"}
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <Link href="/pos/orders" className="flex h-12 items-center gap-2 rounded-xl bg-[#574235] px-[18px] text-base font-semibold text-[#F5EDE3]">
          <ClipboardList aria-hidden="true" size={20} /> ออเดอร์วันนี้
        </Link>
        <div className="flex h-12 items-center gap-2.5 rounded-xl bg-[#574235] px-3.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#C69C72] font-bold text-[#3B2A20]">{thaiInitial(staffName)}</span>
          <span className="text-[15px] leading-tight">{staffName}<br /><span className="text-xs text-[#E9D9C6]">{staffRole}</span></span>
        </div>
        <button type="button" aria-label="ออกจากระบบ" disabled={pending} onClick={() => { onLogout(); startTransition(() => { void logoutPos(); }); }}
          className="flex size-12 items-center justify-center rounded-xl bg-[#574235] disabled:opacity-60">
          <LogOut aria-hidden="true" size={22} />
        </button>
      </div>
    </header>
  );
}
