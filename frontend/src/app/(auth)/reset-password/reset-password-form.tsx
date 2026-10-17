"use client";

import { useActionState, useId } from "react";
import { resetPassword, type AuthActionState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const initialState: AuthActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const id = useId();
  const [state, action, pending] = useActionState(resetPassword, initialState);
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor={`${id}-password`}>รหัสผ่านใหม่</Label>
        <Input id={`${id}-password`} name="password" type="password" autoComplete="new-password" minLength={8} required />
        {state.errors?.password?.[0] ? <p className="text-sm text-destructive">{state.errors.password[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-confirm`}>ยืนยันรหัสผ่านใหม่</Label>
        <Input id={`${id}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        {state.errors?.confirmPassword?.[0] ? <p className="text-sm text-destructive">{state.errors.confirmPassword[0]}</p> : null}
      </div>
      {state.message ? <div role="status" className="space-y-2"><p className="text-sm text-destructive">{state.message}</p><Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">ขอลิงก์ใหม่</Link></div> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</Button>
    </form>
  );
}
