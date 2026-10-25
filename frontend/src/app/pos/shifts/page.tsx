import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { formatBaht } from "@/lib/money";
import { requirePosStaff } from "@/server/pos-session";
import { listShifts } from "@/server/shifts";
import { ShiftForm } from "./shift-form";

export const instant = false;

export default async function ShiftsPage() {
  await connection();
  const session = await requirePosStaff();
  const state = await listShifts(session.shopId, session.staff.id);
  const active = state.shifts.find((shift) => !shift.closedAt);
  const canClose = active && (active.openedBy === session.staff.id || session.staff.role !== "barista");
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <Link href="/pos" className="inline-block py-3 underline">กลับไปขายหน้าร้าน</Link>
    <h1 className="text-3xl font-bold">กะเงินสดและส่งมอบลิ้นชัก</h1>
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      {active ? <>
        <h2 className="text-xl font-semibold">กะที่เปิดอยู่ — {active.openedByName}</h2>
        <p className="mt-2">เงินทอนเริ่มต้น {formatBaht(active.openingFloatSatang)}</p>
        <p className="mt-2 text-xl">เงินสดที่ควรมี {formatBaht(active.expectedCashSatang)}</p>
        <p className="mt-2 text-sm">ยอดจะคำนวณอีกครั้งเมื่อยืนยันปิดกะ กรุณานับเงินสดจริง รวมเงินทอนเริ่มต้น</p>
        {canClose ? <ShiftForm requestId={randomUUID()} shiftId={active.id} recipients={state.recipients} />
          : <p className="mt-4">ให้ผู้เปิดกะหรือผู้จัดการยืนยันยอดและปิดกะนี้</p>}
      </> : <>
        <h2 className="text-xl font-semibold">ยังไม่มีกะเงินสดเปิดอยู่</h2>
        <p className="mt-2 text-amber-800">กรุณาเปิดกะก่อนขายเงินสด ระบบจะบันทึกการขายเงินสดได้เมื่อมีกะเปิดอยู่เท่านั้น</p>
        <ShiftForm requestId={randomUUID()} recipients={state.recipients} />
      </>}
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">กะล่าสุด</h2>
      {state.shifts.filter((shift) => shift.closedAt).map((shift) => <article key={shift.id} className="rounded-xl bg-white p-4">
        <p className="font-semibold">{shift.openedByName} — {new Date(shift.closedAt!).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
        <p>ควรมี {formatBaht(shift.expectedCashSatang)} · นับได้ {formatBaht(shift.countedCashSatang ?? 0)} · ส่วนต่าง {formatBaht(shift.differenceSatang ?? 0)}</p>
        <p>ผู้รับมอบ: {state.recipients.find((staff) => staff.id === shift.handedToStaffId)?.name ?? (shift.handedToStaffId ? "พนักงานที่ไม่ได้ใช้งานแล้ว" : "ไม่ระบุ")}</p>
      </article>)}
    </section>
  </main>;
}
