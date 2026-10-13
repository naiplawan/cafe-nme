"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { adjustMemberStampsAction, deleteMemberAction } from "./actions";

export function AdjustStampsForm({ memberId }: { memberId: string }) {
  const [message, action, pending] = useActionState(adjustMemberStampsAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="memberId" value={memberId} />
      <label className="grid gap-1 text-sm">จำนวนแสตมป์ (+ เพิ่ม / - ลด)<Input name="delta" type="number" step="1" required /></label>
      <label className="grid gap-1 text-sm">หมายเหตุ<Input name="note" maxLength={200} /></label>
      <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "ปรับแสตมป์"}</Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </form>
  );
}

export function DeleteMemberForm({ memberId }: { memberId: string }) {
  const [message, action, pending] = useActionState(deleteMemberAction, null);
  return (
    <ConfirmSubmit action={action} className="space-y-3" destructive confirmLabel="ลบ" message="ยืนยันลบข้อมูลส่วนบุคคลของสมาชิกคนนี้หรือไม่?">
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-sm text-muted-foreground">ข้อมูลส่วนบุคคลจะถูกลบและไม่สามารถกู้คืนได้</p>
      <Button type="submit" variant="destructive" disabled={pending}>{pending ? "กำลังลบ…" : "ลบข้อมูลสมาชิก"}</Button>
      {message && <p role="status" className="text-sm text-destructive">{message}</p>}
    </ConfirmSubmit>
  );
}
