"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Keypad } from "@/app/pos/_components/keypad";
import { gsap, MOTION, useGSAP } from "@/components/motion/gsap";
import { pairDeviceAction } from "./actions";

function PairButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending} className="h-16 w-full rounded-2xl bg-[#4A2C1A] text-xl font-bold text-[#F7F1E7] hover:bg-[#6B4226] disabled:bg-[#D1C1A8]">
    {pending ? "กำลังเชื่อมต่อ…" : "จับคู่แท็บเล็ต"}
  </Button>;
}

export function PairForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [state, action] = useActionState(pairDeviceAction, { message: null, success: false });
  const [code, setCode] = useState(initialCode);
  const formRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<HTMLDivElement>(null);
  const previousCodeLengthRef = useRef(0);

  useGSAP(() => {
    if (code.length > previousCodeLengthRef.current) {
      const lastBox = boxesRef.current?.querySelector(`[data-code-index="${code.length - 1}"]`);
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        if (lastBox) gsap.fromTo(lastBox, { scale: 0.82 }, { scale: 1, duration: MOTION.fast, ease: MOTION.pop });
      });
      previousCodeLengthRef.current = code.length;
      return () => media.revert();
    }
    previousCodeLengthRef.current = code.length;
  }, { scope: formRef, dependencies: [code.length], revertOnUpdate: true });

  useGSAP(() => {
    if (state.success || code.length >= 8) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to("[data-pair-caret]", { opacity: 0.2, duration: 0.55, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
    return () => media.revert();
  }, { scope: formRef, dependencies: [code.length, state.success], revertOnUpdate: true });

  useGSAP(() => {
    const media = gsap.matchMedia();
    if (state.message) {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(boxesRef.current, { x: -7 }, { x: 7, duration: 0.045, repeat: 3, yoyo: true, ease: "power1.inOut", onComplete: () => { gsap.set(boxesRef.current, { x: 0 }); setCode(""); } });
        gsap.fromTo("[data-pair-error]", { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
      });
      media.add("(prefers-reduced-motion: reduce)", () => setCode(""));
    }
    if (state.success) {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo("[data-pair-check]", { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.fast, ease: MOTION.ease, onComplete: () => router.replace("/pos/login") });
      });
      media.add("(prefers-reduced-motion: reduce)", () => router.replace("/pos/login"));
    }
    return () => media.revert();
  }, { scope: formRef, dependencies: [state.message, state.success], revertOnUpdate: true });

  return <section ref={formRef} className="w-full max-w-[460px] rounded-[24px] border border-[#E2D8C7] bg-[#FFFFFF] p-8 text-[#4A2C1A] shadow-[0_18px_48px_rgba(59,42,32,0.08)] sm:p-10">
    <header className="mb-7 flex flex-col items-center gap-4 text-center">
      <Image src="/assets/yelo-coffee-mascot.png" alt="" width={64} height={64} className="size-16 rounded-2xl" />
      <h1 className="m-0 text-[28px] font-bold">จับคู่แท็บเล็ตกับร้าน</h1>
    </header>
    <form action={action} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <div ref={boxesRef} role="img" aria-label={`รหัสจับคู่ ${code.length} จาก 8 หลัก`} className="relative flex justify-center gap-1.5">
        {Array.from({ length: 8 }, (_, index) => index + 1).map((position) => <span key={position} data-code-index={position - 1} className={`relative flex h-14 w-9 items-center justify-center rounded-xl border-2 text-xl font-bold tabular-nums sm:w-11 sm:text-2xl ${state.success ? "border-[#2F6B3F] bg-[#E7F1E8] text-[#245232]" : code[position - 1] ? "border-[#4A2C1A] bg-[#F7F1E7]" : "border-[#E2D8C7] bg-white"}`}>
          {code[position - 1] ?? (position - 1 === code.length && !state.success ? <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded bg-[#F4B942]" data-pair-caret /> : "")}
        </span>)}
        {state.success ? <svg aria-hidden="true" className="pointer-events-none absolute -bottom-3 right-2 size-7" viewBox="0 0 24 24" fill="none" stroke="#2F6B3F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path data-pair-check d="m5 12 4 4L19 6" /></svg> : null}
      </div>
      {state.message ? <p data-pair-error role="alert" className="text-center text-sm font-semibold text-[#8E3415]">{state.message}</p> : null}
      <Keypad value={code} onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 8))} maxLength={8} keyClassName="h-[68px]" className="gap-2.5" />
      <PairButton disabled={code.length !== 8 || Boolean(state.success)} />
    </form>
    <p className="mt-5 text-center text-sm text-[#6B5E55]">ดูรหัสได้ที่หลังร้าน › เครื่อง POS</p>
  </section>;
}
