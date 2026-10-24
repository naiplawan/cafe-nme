import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { formatBaht } from "@/lib/money";
import { getSubscription } from "@/server/subscriptions";
import { AdminPageHeader } from "../_components/page-header";
import { RenewalForm } from "./renewal-form";

const date = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
const statusLabels = { trial: "ทดลองใช้ Pro", active: "ใช้งานแพ็กเกจ", expired: "สิทธิ์ Pro หมดอายุ" };

export default async function SubscriptionPage() {
  const session = await requireStaff();
  const state = await getSubscription(session.shopId, session.staff.id, session.userId);
  return <div className="space-y-6">
    <AdminPageHeader section="แพ็กเกจ" title="แพ็กเกจร้านและประวัติต่ออายุ" description="ช่วงทดลอง 14 วัน และการบันทึกต่ออายุโดยผู้ดูแลแพลตฟอร์ม" />
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">{statusLabels[state.status]}</h2>
      <p>สิทธิ์ที่ใช้ได้ขณะนี้: <strong>{state.effectivePlan === "pro" ? "Pro" : "Basic"}</strong></p>
      <p>ทดลองใช้ตั้งแต่ {date(state.trialStartedAt)} ถึง {date(state.trialEndsAt)}</p>
      {state.paidUntil ? <p>แพ็กเกจที่บันทึก: {state.plan === "pro" ? "Pro" : "Basic"} · ต่ออายุถึง {date(state.paidUntil)}</p> : <p>ยังไม่มีรายการต่ออายุที่บันทึก</p>}
      <p className="text-sm text-muted-foreground">เมื่อสิทธิ์ Pro หมดอายุ ยังขายหน้าร้าน ตรวจสอบรายการเดิม ดูรายงาน จัดการกะ คืนเงิน และแสดงเมนูสาธารณะได้ ข้อมูลเดิมยังเปิดดูได้</p>
    </section>
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Basic</h2><p className="mt-2">POS · รายงาน · กะเงินสด · คืนเงิน · เมนูสาธารณะ</p></section>
      <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Pro</h2><p className="mt-2">ทุกอย่างใน Basic พร้อมสั่งอาหารด้วยตนเอง จัดการสต็อกและสูตร และสะสมแต้มข้ามสาขา</p></section>
    </div>
    {state.canRecordPayment ? <RenewalForm requestId={randomUUID()} />
      : <p className="rounded-xl border bg-card p-5">การต่ออายุในช่วงนำร่องให้ผู้ดูแลแพลตฟอร์มตรวจหลักฐานและบันทึกยอดตามที่ตกลง ไม่มีการเรียกเก็บเงินอัตโนมัติ</p>}
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">ประวัติการต่ออายุที่บันทึก</h2>
      {state.payments.length === 0 ? <p className="mt-3">ยังไม่มีรายการ</p> : <div className="mt-3 divide-y">
        {state.payments.map((payment) => <article key={payment.id} className="space-y-1 py-3">
          <p className="font-semibold">{payment.plan === "pro" ? "Pro" : "Basic"} · {payment.periodDays} วัน · {formatBaht(payment.paidAmountSatang)}</p>
          <p className="text-sm">ช่วงที่เพิ่ม: {date(payment.periodStartsAt)} ถึง {date(payment.periodEndsAt)}</p>
          <p className="text-sm">หลักฐาน: {payment.externalReceiptRef}</p>
          <p className="text-xs text-muted-foreground">บันทึกด้วยตนเองเมื่อ {date(payment.createdAt)}</p>
        </article>)}
      </div>}
    </section>
  </div>;
}
