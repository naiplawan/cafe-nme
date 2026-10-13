"use client";

import { useActionState, useRef } from "react";
import { createShop, type AuthActionState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";

const initialState: AuthActionState = {};

export function OnboardingForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createShop, initialState);
  useGSAP(() => {
    if (prefersReducedMotion() || !formRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const card = formRef.current?.closest("[data-auth-card]");
      if (card) gsap.fromTo(card, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
      const fields = formRef.current?.querySelectorAll("[data-auth-field]");
      if (fields?.length) gsap.fromTo(fields, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease });
      const line = card?.querySelector<SVGPathElement>("[data-logo-line]");
      if (line) gsap.fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: formRef });

  return (
    <form key={JSON.stringify(state.values ?? {})} ref={formRef} action={action} noValidate className="space-y-4">
      <div data-auth-field className="space-y-2">
        <Label htmlFor="shopName">ชื่อร้าน</Label>
        <Input id="shopName" name="shopName" maxLength={80} defaultValue={state.values?.shopName ?? ""} required />
        {state.errors?.shopName?.[0] && <p className="text-sm text-destructive">{state.errors.shopName[0]}</p>}
      </div>
      <div data-auth-field className="space-y-2">
        <Label htmlFor="ownerName">ชื่อของคุณ</Label>
        <Input id="ownerName" name="ownerName" autoComplete="name" maxLength={80} defaultValue={state.values?.ownerName ?? ""} required />
        {state.errors?.ownerName?.[0] && <p className="text-sm text-destructive">{state.errors.ownerName[0]}</p>}
      </div>
      <div data-auth-field className="space-y-2">
        <Label htmlFor="promptpayId">PromptPay ID <span className="text-muted-foreground">(ไม่บังคับ)</span></Label>
        <Input id="promptpayId" name="promptpayId" inputMode="numeric" placeholder="เบอร์โทรศัพท์หรือเลขประจำตัว" defaultValue={state.values?.promptpayId ?? ""} />
        {state.errors?.promptpayId?.[0] && <p className="text-sm text-destructive">{state.errors.promptpayId[0]}</p>}
      </div>
      <div data-auth-field className="space-y-2">
        <Label htmlFor="pin">PIN สำหรับเข้า POS (4–6 หลัก)</Label>
        <Input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="new-password" required />
        <p className="text-sm text-muted-foreground">ใช้ PIN นี้เข้าหน้าขายบนแท็บเล็ต</p>
        {state.errors?.pin?.[0] && <p className="text-sm text-destructive">{state.errors.pin[0]}</p>}
      </div>
      <div data-auth-field className="space-y-2">
        <Label htmlFor="confirmPin">ยืนยัน PIN</Label>
        <Input id="confirmPin" name="confirmPin" type="password" inputMode="numeric" autoComplete="new-password" required />
        {state.errors?.confirmPin?.[0] && <p className="text-sm text-destructive">{state.errors.confirmPin[0]}</p>}
      </div>
      {state.message && <p role="status" className="text-sm text-destructive">{state.message}</p>}
      <Button data-auth-field type="submit" className="w-full" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "สร้างร้าน"}
      </Button>
    </form>
  );
}
