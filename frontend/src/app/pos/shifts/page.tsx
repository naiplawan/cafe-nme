import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { formatBaht } from "@/lib/money";
import { requirePosStaff } from "@/server/pos-session";
import { listCashMovements, listShifts } from "@/server/shifts";
import { CashMovementForm, ShiftForm } from "./shift-form";

export const instant = false;

export default async function ShiftsPage() {
  await connection();
  const session = await requirePosStaff();
  const state = await listShifts(session.shopId, session.staff.id);
  const active = state.shifts.find((shift) => !shift.closedAt);
  const movements = active ? await listCashMovements(session.shopId, session.staff.id, active.id) : [];
  const canClose = active && (active.openedBy === session.staff.id || session.staff.role !== "barista");
  return <main className="min-h-dvh bg-[#F5EDE3] p-4 text-[#3B2A20] sm:p-6"><div className="mx-auto max-w-4xl space-y-6">
    <Link href="/pos" className="inline-flex min-h-12 items-center rounded-xl border border-[#D9C5B0] bg-[#FFFBF6] px-5 font-semibold">กลับไปขายหน้าร้าน</Link>
    <h1 className="text-3xl font-bold">กะเงินสดและส่งมอบลิ้นชัก</h1>
    <section className="rounded-2xl border border-[#D9C5B0] bg-[#FFFBF6] p-6 shadow-sm">
      {active ? <>
        <h2 className="text-xl font-semibold">กะที่เปิดอยู่ — {active.openedByName}</h2>
        <p className="mt-2">เงินทอนเริ่มต้น {formatBaht(active.openingFloatSatang)}</p>
        <p className="mt-2 text-xl">เงินสดที่ควรมี {formatBaht(active.expectedCashSatang)}</p>
        <Link href={`/pos/shifts/${active.id}`} className="inline-block py-3 underline">ดูบัญชีเงินสดกะนี้</Link>
        <p className="mt-2 text-sm">ยอดจะคำนวณอีกครั้งเมื่อยืนยันปิดกะ กรุณานับเงินสดจริง รวมเงินทอนเริ่มต้น</p>
        {session.staff.role !== 'barista' ? <details className="mt-6 rounded-xl border border-[#D9C5B0] px-4">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold">บันทึกเงินเข้า–ออกลิ้นชัก (ผู้จัดการ)</summary>
          <div className="pb-4"><CashMovementForm key={movements.length} requestId={randomUUID()} shiftId={active.id} /></div>
        </details> : null}
        {movements.length ? <ul className="mt-4 space-y-2" aria-label="เงินเข้าออกลิ้นชัก">{movements.map((movement) => <li key={movement.id}>
          {{ float_topup: 'เติมเงินทอน', petty_cash: 'จ่ายเงินสดย่อย', bank_deposit: 'นำเงินออกฝาก' }[movement.kind]} {formatBaht(movement.amountSatang)} — {movement.reason}
          {' · '}{state.recipients.find((staff) => staff.id === movement.approvedByStaffId)?.name ?? 'พนักงานที่ไม่ได้ใช้งานแล้ว'}
        </li>)}</ul> : null}
        {canClose ? <div className="mt-6 border-t border-[#E4D6C6] pt-6">
          <h3 className="text-lg font-semibold">ปิดกะและส่งมอบลิ้นชัก</h3>
          <ShiftForm requestId={randomUUID()} shiftId={active.id} recipients={state.recipients} />
        </div>
          : <p className="mt-4">ให้ผู้เปิดกะหรือผู้จัดการยืนยันยอดและปิดกะนี้</p>}
      </> : <>
        <h2 className="text-xl font-semibold">ยังไม่มีกะเงินสดเปิดอยู่</h2>
        <p className="mt-2 rounded-xl bg-[#F7DCD0] p-3 text-[#8E3415]">กรุณาเปิดกะก่อนขายเงินสด ระบบจะบันทึกการขายเงินสดได้เมื่อมีกะเปิดอยู่เท่านั้น</p>
        <ShiftForm requestId={randomUUID()} recipients={state.recipients} />
      </>}
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">กะล่าสุด</h2>
      {state.shifts.filter((shift) => shift.closedAt).map((shift) => <article key={shift.id} className="rounded-xl border border-[#D9C5B0] bg-[#FFFBF6] p-4">
        <p className="font-semibold">{shift.openedByName} — {new Date(shift.closedAt!).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
        <p>ควรมี {formatBaht(shift.expectedCashSatang)} · นับได้ {formatBaht(shift.countedCashSatang ?? 0)} · ส่วนต่าง {formatBaht(shift.differenceSatang ?? 0)}</p>
        <Link href={`/pos/shifts/${shift.id}`} className="inline-block py-3 underline">ดูบัญชีเงินสดและผู้อนุมัติ</Link>
        <p>ผู้รับมอบ: {state.recipients.find((staff) => staff.id === shift.handedToStaffId)?.name ?? (shift.handedToStaffId ? "พนักงานที่ไม่ได้ใช้งานแล้ว" : "ไม่ระบุ")}</p>
      </article>)}
    </section>
  </div></main>;
}
