"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset, requestPasswordReset } from "@/server/password-recovery-actions";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const id = useId();
  const [token, setToken] = useState<string | null>(null);
  const [state, action, pending] = useActionState(reset ? confirmPasswordReset : requestPasswordReset, { message: "" });
  useEffect(() => {
    if (reset) setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  }, [reset]);
  useEffect(() => {
    if (reset && state.success) window.history.replaceState(null, "", window.location.pathname);
  }, [reset, state.success]);
  const validLink = token !== null && /^[A-Za-z0-9_-]{43}$/.test(token);
  return <main className="grid min-h-dvh place-items-center bg-muted/40 p-4">
    <section className="w-full max-w-md space-y-5 rounded-2xl border bg-background p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{reset ? "ตั้งรหัสผ่านใหม่" : "ลืมรหัสผ่าน"}</h1>
      {!state.success && (!reset || validLink) && <form action={action} className="space-y-4">
        {reset ? <>
          <input type="hidden" name="token" value={token ?? ""} />
          <div className="space-y-2"><Label htmlFor={`${id}-password`}>รหัสผ่านใหม่</Label><Input id={`${id}-password`} name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-confirm`}>ยืนยันรหัสผ่านใหม่</Label><Input id={`${id}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div>
        </> : <div className="space-y-2"><Label htmlFor={`${id}-email`}>อีเมลบัญชีของคุณ</Label><Input id={`${id}-email`} name="email" type="email" autoComplete="email" defaultValue={state.email} maxLength={254} required /></div>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? "กำลังดำเนินการ…" : reset ? "บันทึกรหัสผ่านใหม่" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</Button>
      </form>}
      {reset && !state.success && !validLink && <p role="status">{token === null ? "กำลังตรวจสอบลิงก์…" : "ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่"}</p>}
      {state.message && <p role={state.success ? "status" : "alert"} className="text-sm">{state.message}</p>}
      {reset && !state.success && <Link className="block underline" href="/forgot-password">ขอลิงก์ใหม่</Link>}
      <Link className="block underline" href="/login">กลับไปเข้าสู่ระบบ</Link>
    </section>
  </main>;
}
