"use client";
import { useActionState } from "react";
import { reviewPaymentAction } from "./actions";
export function ReviewForm({paymentId,requestId}:{paymentId:string;requestId:string}) {
  const [state,action,pending]=useActionState(reviewPaymentAction,{message:null});
  return <form action={action} className="grid gap-3 sm:grid-cols-3">
    <input type="hidden" name="paymentId" value={paymentId}/><input type="hidden" name="requestId" value={requestId}/>
    <label className="grid gap-1 text-sm">ยอดที่ตรวจพบ (บาท)<input name="observed" required inputMode="decimal" placeholder="0.00" className="min-h-11 rounded-lg border bg-background px-3"/></label>
    <label className="grid gap-1 text-sm">หมายเหตุ / เหตุผลยอดต่าง<input name="note" maxLength={500} className="min-h-11 rounded-lg border bg-background px-3"/></label>
    <button type="submit" disabled={pending} className="min-h-11 self-end rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50">{pending?"กำลังบันทึก…":"บันทึกการตรวจด้วยคน"}</button>
    {state.message ? <p role={state.success?"status":"alert"} className="text-sm sm:col-span-3">{state.message}</p>:null}
  </form>;
}
