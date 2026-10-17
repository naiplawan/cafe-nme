"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearPromptPayAction, savePromptPayAction, type PromptPayActionState } from "./actions";

const initialState: PromptPayActionState = { message: null, success: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="min-h-11" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก PromptPay ID"}</Button>;
}

function ActionMessage({ state }: { state: PromptPayActionState }) {
  return state.message ? <p className={`text-sm ${state.success ? "text-emerald-700" : "text-destructive"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

function ClearButton() {
  const [state, action, pending] = useActionState(clearPromptPayAction, initialState);
  return <form action={action} className="space-y-2">
    <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>
      {pending ? "กำลังปิด…" : "ปิดพร้อมเพย์"}
    </Button>
    <ActionMessage state={state} />
  </form>;
}

export function PromptPaySettingsForm({ configured, maskedId }: { configured: boolean; maskedId: string | null }) {
  const [state, action] = useActionState(savePromptPayAction, initialState);
  const inputId = useId();

  return <Card>
    <CardHeader className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>QR พร้อมเพย์</CardTitle>
        <Badge variant={configured ? "secondary" : "outline"}>{configured ? "เปิดใช้งาน" : "ยังไม่ได้ตั้งค่า"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">กำหนดบัญชีที่ร้านใช้รับเงินจาก QR พร้อมเพย์ในหน้า POS</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-6">
        <p className="font-medium">ก่อนตั้งค่า</p>
        <p className="mt-1 text-muted-foreground">ลงทะเบียนหมายเลขรับเงินกับธนาคารก่อน ใช้เบอร์มือถือหรือเลขประจำตัว 13 หลักที่ผูกพร้อมเพย์กับบัญชีรับเงินของร้าน</p>
        <p className="mt-1 text-muted-foreground">หลังบันทึก ให้ลองสแกน QR ในแอปธนาคารและตรวจชื่อผู้รับก่อนเริ่มรับเงินจริง</p>
      </div>

      {configured && maskedId ? <p className="text-sm">PromptPay ID ปัจจุบัน <span className="font-medium tabular-nums">{maskedId}</span></p> : null}

      <form action={action} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={inputId}>PromptPay ID ใหม่</Label>
          <Input id={inputId} name="promptpayId" type="text" inputMode="numeric" autoComplete="off" maxLength={16} placeholder="เช่น 08xxxxxxxx" className="min-h-11" required />
          <p className="text-xs text-muted-foreground">กรอกเบอร์มือถือ 10 หลักหรือเลขประจำตัว 13 หลัก ระบบจะแสดงเฉพาะเลขท้ายหลังบันทึก</p>
        </div>
        <SaveButton />
        <ActionMessage state={state} />
      </form>

      {configured ? <div className="border-t pt-4"><ClearButton /></div> : null}
    </CardContent>
  </Card>;
}
