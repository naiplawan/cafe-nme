"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signUp, type AuthActionState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";

const initialState: AuthActionState = {};

export function SignupForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(signUp, initialState);
  useEffect(() => {
    if (!state.errors && !state.message) return;
    formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [state.errors, state.message]);
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
    <form key={state.email ?? ""} ref={formRef} action={action} noValidate className="space-y-4">
      <div data-auth-field className="space-y-2">
        <Label htmlFor={`${id}-email`}>อีเมล</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="name@example.com" defaultValue={state.email ?? ""} aria-invalid={Boolean(state.errors?.email?.[0])} aria-describedby={state.errors?.email?.[0] ? `${id}-email-error` : undefined} required />
        {state.errors?.email?.[0] && <p id={`${id}-email-error`} role="alert" className="text-sm text-destructive">{state.errors.email[0]}</p>}
      </div>
      <div data-auth-field className="space-y-2">
        <Label htmlFor={`${id}-password`}>รหัสผ่าน</Label>
        <div className="relative">
          <Input id={`${id}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="กรอกรหัสผ่าน" minLength={8} aria-invalid={Boolean(state.errors?.password?.[0])} aria-describedby={state.errors?.password?.[0] ? `${id}-password-error ${id}-password-hint` : `${id}-password-hint`} className="pr-12" required />
          <Button type="button" variant="ghost" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} className="absolute right-0 top-1/2 size-11 -translate-y-1/2" onClick={() => setShowPassword((shown) => !shown)}>
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
        <p id={`${id}-password-hint`} className="text-sm text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>
        {state.errors?.password?.[0] && <p id={`${id}-password-error`} role="alert" className="text-sm text-destructive">{state.errors.password[0]}</p>}
      </div>
      {state.message && <p role="alert" tabIndex={-1} className="text-sm text-destructive">{state.message}</p>}
      <Button data-auth-field type="submit" className="w-full" disabled={pending}>
        {pending ? "กำลังสร้างบัญชี…" : "สร้างบัญชี"}
      </Button>
    </form>
  );
}
