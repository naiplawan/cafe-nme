"use client";

import { useActionState } from "react";
import { closeShiftAction, openShiftAction } from "./actions";

export function ShiftForm({ requestId, shiftId, recipients }: {
  requestId: string;
  shiftId?: string;
  recipients: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(shiftId ? closeShiftAction : openShiftAction, null);
  return <form action={action} className="mt-4 grid max-w-md gap-4">
    <input type="hidden" name="requestId" value={requestId} />
    {shiftId ? <input type="hidden" name="shiftId" value={shiftId} /> : null}
    <label className="grid gap-2 font-medium">
      {shiftId ? "เงินสดที่นับได้ (บาท)" : "เงินทอนเริ่มต้น (บาท)"}
      <input name="amount" type="number" min="0" max="21474836.47" step="0.01" required disabled={pending}
        className="min-h-12 rounded-xl border bg-white px-3" />
    </label>
    {shiftId ? <label className="grid gap-2 font-medium">ส่งมอบให้
      <select name="handedToStaffId" disabled={pending} className="min-h-12 rounded-xl border bg-white px-3">
        <option value="">ไม่ระบุผู้รับมอบ</option>
        {recipients.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
      </select>
    </label> : null}
    <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-[#3B2A20] px-5 font-semibold text-white disabled:opacity-50">
      {pending ? "กำลังบันทึก…" : shiftId ? "ยืนยันยอดและปิดกะ" : "เปิดกะเงินสด"}
    </button>
    {state ? <p role="status" className={state.ok ? "text-green-800" : "text-red-800"}>{state.message}</p> : null}
  </form>;
}
