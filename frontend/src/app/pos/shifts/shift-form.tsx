"use client";

import { useActionState, useState } from "react";
import { parseBahtToSatang } from "@/lib/money";
import { Keypad } from "@/app/pos/_components/keypad";
import { cashMovementAction, closeShiftAction, openShiftAction } from "./actions";

const AMOUNT_INPUT = /^\d{0,8}(\.\d{0,2})?$/;

export function ShiftForm({ requestId, shiftId, recipients }: {
  requestId: string;
  shiftId?: string;
  recipients: { id: string; name: string }[];
}) {
  const [amount, setAmount] = useState("");
  const [state, action, pending] = useActionState(shiftId ? closeShiftAction : openShiftAction, null);
  return <form action={action} className="mt-4 grid max-w-md gap-4">
    <input type="hidden" name="requestId" value={requestId} />
    {shiftId ? <input type="hidden" name="shiftId" value={shiftId} /> : null}
    <AmountEntry amount={amount} onChange={setAmount} label={shiftId ? "เงินสดที่นับได้ (บาท)" : "เงินทอนเริ่มต้น (บาท)"} pending={pending} />
    {shiftId ? <label className="grid gap-2 font-medium">ส่งมอบให้
      <select name="handedToStaffId" disabled={pending} className="min-h-12 rounded-xl border border-[#E2D8C7] bg-[#FFFFFF] px-3">
        <option value="">ไม่ระบุผู้รับมอบ</option>
        {recipients.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
      </select>
    </label> : null}
    <button type="submit" disabled={pending || !validAmount(amount)} className="min-h-12 rounded-xl bg-[#4A2C1A] px-5 font-semibold text-white disabled:opacity-50">
      {pending ? "กำลังบันทึก…" : shiftId ? "ยืนยันยอดและปิดกะ" : "เปิดกะเงินสด"}
    </button>
    {state ? <p role="status" className={`rounded-xl p-3 ${state.ok ? "bg-[#E7F1E8] text-[#245232]" : "bg-[#F7DCD0] text-[#8E3415]"}`}>{state.message}</p> : null}
  </form>;
}

export function CashMovementForm({ requestId, shiftId }: { requestId: string; shiftId: string }) {
  const [amount, setAmount] = useState("");
  const [state, action, pending] = useActionState(cashMovementAction, null);
  return <form action={action} className="mt-6 grid max-w-md gap-3">
    <h3 className="text-lg font-semibold">ผู้จัดการอนุมัติเงินเข้า–ออกลิ้นชัก</h3>
    <input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="shiftId" value={shiftId} />
    <label>ประเภทรายการ<select name="kind" className="min-h-12 w-full rounded-xl border border-[#E2D8C7] bg-[#FFFFFF] px-3" disabled={pending}>
      <option value="float_topup">เติมเงินทอน</option><option value="petty_cash">จ่ายเงินสดย่อย</option><option value="bank_deposit">นำเงินออกฝากธนาคาร / ตู้เซฟ</option>
    </select></label>
    <AmountEntry amount={amount} onChange={setAmount} label="จำนวนเงิน (บาท)" pending={pending || state?.ok === true} positive />
    <label>เหตุผล / เลขที่เอกสาร<input className="min-h-12 w-full rounded-xl border border-[#E2D8C7] bg-[#FFFFFF] px-3" name="reason" maxLength={500} required disabled={pending} /></label>
    <button type="submit" disabled={pending || state?.ok || !validAmount(amount, true)} className="min-h-12 rounded bg-[#4A2C1A] text-white disabled:opacity-50">อนุมัติและบันทึก</button>
    {state ? <p role="status" className={`rounded-xl p-3 ${state.ok ? "bg-[#E7F1E8] text-[#245232]" : "bg-[#F7DCD0] text-[#8E3415]"}`}>{state.message}</p> : null}
  </form>;
}

function validAmount(amount: string, positive = false) {
  const satang = parseBahtToSatang(amount);
  return satang !== null && satang >= (positive ? 1 : 0) && satang <= 2147483647;
}

function AmountEntry({ label, pending, amount, onChange, positive = false }: { label: string; pending: boolean; amount: string; onChange: (next: string) => void; positive?: boolean }) {
  const valid = validAmount(amount, positive);
  return <fieldset disabled={pending} className="grid gap-3">
    <label className="grid gap-2 font-medium">{label}<input name="amount" value={amount} onChange={(event) => { if (AMOUNT_INPUT.test(event.target.value)) { onChange(event.target.value); } }} inputMode="none" placeholder="0.00" className="min-h-14 w-full rounded-xl border border-[#E2D8C7] bg-[#FFFFFF] px-3 text-3xl font-bold tabular-nums" /></label>
    <Keypad value={amount} onChange={onChange} decimal maxIntegerDigits={8} maxLength={11} keyClassName="h-14" />
    {amount && !amount.endsWith(".") && !valid ? <p className="text-sm text-[#8E3415]">ระบุยอด{positive ? "มากกว่า 0" : "ตั้งแต่ 0"} ถึง 21,474,836.47 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)</p> : null}
  </fieldset>;
}
