"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand";
import { Keypad } from "@/app/pos/_components/keypad";
import { gsap, MOTION, useGSAP } from "@/components/motion/gsap";
import { thaiInitial } from "@/lib/thai";
import { staffLoginAction } from "./actions";

type StaffTile = { id: string; name: string; role: string };
const roleNames: Record<string, string> = { owner: "เจ้าของร้าน", manager: "ผู้จัดการ", barista: "บาริสต้า" };

function LoginButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending} className="h-[72px] w-full rounded-[18px] bg-[#3B2A20] text-[22px] font-bold text-[#F5EDE3] hover:bg-[#574235] disabled:bg-[#C9B6A4]">
    {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
  </Button>;
}

export function LoginForm({ staff, shopName, deviceName, logoUrl }: { staff: StaffTile[]; shopName: string; deviceName: string; logoUrl: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StaffTile | null>(null);
  const [pin, setPin] = useState("");
  const [state, action] = useActionState(staffLoginAction, { message: null, success: false });
  const [dismissedError, setDismissedError] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinDotsRef = useRef<HTMLDivElement>(null);
  const previousPinLengthRef = useRef(0);
  const showError = Boolean(state.message) && !dismissedError;

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-staff-tile]", { opacity: 0, y: 12, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: mainRef, dependencies: [staff], revertOnUpdate: true });

  useGSAP(() => {
    if (!selected) return;
    const media = gsap.matchMedia();
    const outline = mainRef.current?.querySelector(`[data-staff-id="${selected.id}"] [data-selection-outline]`);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(panelRef.current, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: MOTION.base, ease: MOTION.ease });
      if (outline) gsap.fromTo(outline, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: mainRef, dependencies: [selected?.id], revertOnUpdate: true });

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
  }, { scope: mainRef, dependencies: [pin.length], revertOnUpdate: true });

  useGSAP(() => {
    if (showError) {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Shake, then clear the wrong digits so the PIN can be retyped straight away.
        gsap.fromTo(pinDotsRef.current, { x: -7 }, { x: 7, duration: 0.045, repeat: 3, yoyo: true, ease: "power1.inOut", onComplete: () => { gsap.set(pinDotsRef.current, { x: 0 }); setPin(""); } });
        gsap.fromTo("[data-login-error]", { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
      });
      media.add("(prefers-reduced-motion: reduce)", () => { gsap.delayedCall(0, () => setPin("")); });
      return () => media.revert();
    }
  }, { scope: mainRef, dependencies: [showError], revertOnUpdate: true });

  useGSAP(() => {
    if (!state.success) return;
    const dots = pinDotsRef.current?.querySelectorAll(".pin-dot");
    if (!dots?.length) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(dots, { scale: 0.86 }, {
        scale: 1, duration: 0.12, stagger: 0.008, ease: MOTION.pop, onComplete: () => router.replace("/pos"),
      });
    });
    media.add("(prefers-reduced-motion: reduce)", () => router.replace("/pos"));
    return () => media.revert();
  }, { scope: mainRef, dependencies: [state.success], revertOnUpdate: true });

  function updatePin(next: string) {
    setPin(next.replace(/\D/g, "").slice(0, 6));
    setDismissedError(true);
  }

  return <main ref={mainRef} className="flex min-h-dvh w-full overflow-hidden bg-[#F5EDE3] text-[#3B2A20] max-[800px]:flex-col">
    <section className="flex min-w-0 flex-1 flex-col gap-7 overflow-y-auto px-10 py-10 lg:px-14">
      <div className="flex items-center gap-4">
        <BrandLogo logoUrl={logoUrl} size={64} className="rounded-2xl" />
        <div className="leading-tight">
          <div className="text-[28px] font-bold">{shopName}</div>
          <div className="mt-1 text-base text-[#6B5547]">{deviceName} · จับคู่แล้ว</div>
        </div>
      </div>
      <h1 className="m-0 text-[32px] font-bold">ใครเข้ากะตอนนี้?</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {staff.map((person) => {
          const isSelected = selected?.id === person.id;
          return <button key={person.id} data-staff-tile data-staff-id={person.id} type="button" disabled={Boolean(state.success)} aria-pressed={isSelected}
            onClick={() => { setSelected(person); setPin(""); setDismissedError(true); }}
            className={`relative flex h-[148px] min-w-0 flex-col items-center justify-center gap-2.5 rounded-[20px] border-[3px] p-2 text-[#3B2A20] transition-colors ${isSelected ? "border-transparent bg-[#FFFBF6] shadow-[0_8px_22px_rgba(59,42,32,0.08)]" : "border-[#E4D6C6] bg-[#FBF5EE]"}`}>
            {isSelected ? <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect data-selection-outline x="1.5" y="1.5" width="97" height="97" rx="15" fill="none" stroke="#3B2A20" strokeWidth="1.5" />
            </svg> : null}
            <span className={`flex size-16 items-center justify-center rounded-full text-[26px] font-bold ${isSelected ? "bg-[#3B2A20] text-[#F5EDE3]" : "bg-[#EADBC8] text-[#3B2A20]"}`}>{thaiInitial(person.name)}</span>
            <span className="max-w-full truncate text-xl font-bold leading-tight">{person.name}</span>
            <span className="text-sm text-[#6B5547]">{roleNames[person.role] ?? person.role}</span>
          </button>;
        })}
      </div>
      {staff.length === 0 ? <div className="rounded-2xl border border-[#E4D6C6] bg-[#FFFBF6] p-6 text-center text-[#6B5547]">
        <p className="m-0 font-semibold text-[#3B2A20]">ยังไม่มีพนักงานที่ตั้ง PIN และเปิดใช้งาน</p>
        <p className="mb-0 mt-2">ให้เจ้าของร้านตั้ง PIN ที่หลังร้าน › พนักงาน</p>
      </div> : null}
    </section>

    <aside className="flex w-[min(460px,42vw)] shrink-0 flex-col items-center gap-[22px] border-l border-[#E4D6C6] bg-[#FFFBF6] px-10 py-10 max-[800px]:w-full max-[800px]:border-l-0 max-[800px]:border-t">
      {selected ? <div ref={panelRef} className="flex w-full flex-col items-center gap-[22px]">
        <div className="text-lg text-[#6B5547]">ใส่ PIN ของ</div>
        <div className="-mt-3 text-[28px] font-bold">{selected.name}</div>
        <div ref={pinDotsRef} role="img" aria-label={`PIN ที่ใส่แล้ว ${pin.length} หลัก`} className="flex h-7 items-center gap-3">
          {Array.from({ length: 6 }, (_, index) => index + 1).map((pinPosition) => <span key={pinPosition} data-pin-index={pinPosition - 1} className={`pin-dot size-[22px] rounded-full border-2 ${state.success ? "border-[#2F6B3F] bg-[#2F6B3F]" : `border-[#3B2A20] ${pinPosition <= pin.length ? "bg-[#3B2A20]" : "bg-transparent"}`}`} />)}
        </div>
        {showError && state.message ? <div data-login-error role="alert" className="text-center text-base font-semibold text-[#8E3415]">{state.message}</div> : null}
        <form action={action} onSubmit={() => { setDismissedError(false); }} className="flex w-full flex-col gap-3">
          <input type="hidden" name="staffId" value={selected.id} />
          <input type="hidden" name="pin" value={pin} />
          <Keypad value={pin} onChange={updatePin} maxLength={6} keyClassName="h-[72px] rounded-[18px] text-[30px]" className="gap-3" />
          <LoginButton disabled={pin.length < 4 || Boolean(state.success)} />
        </form>
      </div> : staff.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-[#6B5547]">
        <span className="text-xl font-semibold text-[#3B2A20]">ยังไม่มีพนักงานที่ตั้ง PIN และเปิดใช้งาน</span>
        <span className="text-base">ให้เจ้าของร้านตั้ง PIN ที่หลังร้าน › พนักงาน</span>
      </div> : <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-[#6B5547]">
        <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#C69C72" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        <span className="text-xl font-semibold text-[#3B2A20]">เลือกชื่อของคุณ</span>
        <span className="text-base">แล้วใส่ PIN 4–6 หลักเพื่อเริ่มขาย</span>
      </div>}
    </aside>
  </main>;
}
