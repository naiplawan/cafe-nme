"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { adjustMemberStampsAction, deleteMemberAction } from "./actions";
import { projectedStampBalance } from "./stamp-adjustment";

export function AdjustStampsForm({ memberId, currentBalance }: { memberId: string; currentBalance: number }) {
  const [message, action, pending] = useActionState(adjustMemberStampsAction, null);
  const [delta, setDelta] = useState("");
  const projectedBalance = projectedStampBalance(currentBalance, delta);
  const id = useId();
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="grid gap-1.5 text-sm"><label htmlFor={`${id}-delta`}>จำนวนแสตมป์ (+ เพิ่ม / - ลด)</label><Input id={`${id}-delta`} name="delta" type="number" step="1" required value={delta} onChange={(event) => setDelta(event.currentTarget.value)} /></div>
      <p className="text-sm text-muted-foreground" aria-live="polite">ยอดหลังปรับ: <span className="font-semibold text-foreground">{projectedBalance ?? currentBalance}</span>{projectedBalance !== null && projectedBalance < 0 ? " · ยอดจะติดลบ" : ""}</p>
      <div className="grid gap-1.5 text-sm"><label htmlFor={`${id}-note`}>หมายเหตุ</label><Input id={`${id}-note`} name="note" maxLength={200} /></div>
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
