"use client";

import { useActionState, useId } from "react";
import { requestPasswordReset, type AuthActionState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const id = useId();
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  return (
    <form action={action} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>อีเมล</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" defaultValue={state.email ?? ""} required />
        {state.errors?.email?.[0] ? <p className="text-sm text-destructive">{state.errors.email[0]}</p> : null}
      </div>
      {state.message ? <p role="status" className="text-sm text-muted-foreground">{state.message}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</Button>
    </form>
  );
}
