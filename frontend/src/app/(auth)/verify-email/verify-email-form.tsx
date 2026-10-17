"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmEmailVerification, type AuthActionState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmailVerification, initialState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm leading-6 text-muted-foreground">กดปุ่มด้านล่างเพื่อยืนยันที่อยู่อีเมลและเปิดใช้งานบัญชีของท่าน</p>
      {state.message && <p role="status" className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "กำลังยืนยัน…" : "ยืนยันที่อยู่อีเมล"}</Button>
      {state.message && <p className="text-center text-sm"><Link href="/verify-email" className="font-medium underline">ขอลิงก์ยืนยันใหม่</Link></p>}
    </form>
  );
}
