"use client";

import { useActionState, useId } from "react";
import { resendEmailVerification, type AuthActionState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ResendVerificationForm({ initialEmail }: { initialEmail?: string }) {
  const id = useId();
  const [state, action, pending] = useActionState(resendEmailVerification, initialState);
  return (
    <form action={action} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>อีเมล</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" defaultValue={state.email ?? initialEmail ?? ""} required />
        {state.errors?.email?.[0] && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
      </div>
      {state.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "กำลังส่ง…" : "ส่งอีเมลยืนยันอีกครั้ง"}</Button>
    </form>
  );
}
