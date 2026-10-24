"use client";

import { useActionState } from "react";
import { recordManualRenewalAction } from "./actions";

const inputClass = "min-h-11 rounded-lg border bg-background px-3";
export function RenewalForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(recordManualRenewalAction, null);
  return <form action={action} className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
    <h2 className="text-lg font-semibold sm:col-span-2">บันทึกการต่ออายุโดยผู้ดูแลแพลตฟอร์ม</h2>
    <p className="text-sm text-muted-foreground sm:col-span-2">บันทึกหลังตรวจหลักฐานการชำระเงินจริงเท่านั้น หน้านี้ไม่ตัดเงินและไม่ยืนยันกับธนาคาร แผนที่เลือกมีผลทันทีหลังช่วงทดลอง โดยเพิ่มวันจากวันหมดอายุเดิมหรือวันนี้หากหมดอายุแล้ว</p>
    <input type="hidden" name="requestId" value={requestId} />
    <label className="grid gap-1">แผน<select name="plan" required disabled={pending} defaultValue="" className={inputClass}>
      <option value="" disabled>เลือกแผนที่ตกลง</option><option value="basic">Basic</option><option value="pro">Pro</option>
    </select></label>
    <label className="grid gap-1">ยอดที่รับชำระจริง (บาท)<input name="amount" type="number" min="0.01" max="21474836.47" step="0.01" required disabled={pending} className={inputClass} /></label>
    <label className="grid gap-1">จำนวนวันที่ต่ออายุ<input name="periodDays" type="number" min="1" max="366" step="1" required disabled={pending} className={inputClass} /></label>
    <label className="grid gap-1">เลขอ้างอิงหลักฐาน<input name="externalReceiptRef" maxLength={200} required disabled={pending} className={inputClass} /></label>
    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{pending ? "กำลังบันทึก…" : "ยืนยันบันทึกหลักฐานและต่ออายุ"}</button>
    {state ? <p role="status" className={state.success ? "text-green-700" : "text-red-700"}>{state.message}</p> : null}
  </form>;
}
