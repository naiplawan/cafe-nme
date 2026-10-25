import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { z } from 'zod';
import { formatBaht } from '@/lib/money';
import { requirePosStaff } from '@/server/pos-session';
import { getCashStatement } from '@/server/shifts';

export const instant = false;
const labels = { sale: 'รับเงินจากการขาย', refund: 'จ่ายคืนลูกค้า', float_topup: 'เติมเงินทอน', petty_cash: 'จ่ายเงินสดย่อย', bank_deposit: 'นำเงินออกฝาก' };
const when = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

export default async function CashStatementPage({ params, searchParams }: {
  params: Promise<{ shiftId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await connection();
  const session = await requirePosStaff();
  const [{ shiftId }, query] = await Promise.all([params, searchParams]);
  const page = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10000)).safeParse(query.page ?? '1');
  if (!z.uuid().safeParse(shiftId).success || !page.success) { notFound(); }
  const statement = await getCashStatement(session.shopId, session.staff.id, shiftId, page.data);
  if (!statement) { notFound(); }
  const { shift, totals } = statement;
  const pages = Math.max(1, Math.ceil(statement.entryCount / statement.pageSize));
  if (page.data > pages) { notFound(); }
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <Link href="/pos/shifts" className="inline-block py-3 underline">กลับไปกะเงินสด</Link>
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">บัญชีเงินสดประจำกะ</h1>
      <p>เปิดโดย {shift.openedByName} · {when(shift.openedAt)}</p>
      {shift.closedAt ? <p>ปิดโดย {statement.closedByName ?? 'ไม่ระบุ'} · {when(shift.closedAt)} · ส่งมอบให้ {statement.handedToName ?? 'ไม่ระบุ'}</p>
        : <p>กะยังเปิดอยู่ ข้อมูลเป็นยอด ณ เวลาโหลดหน้านี้</p>}
    </header>
    <section className="space-y-3 rounded-xl border bg-white p-5" aria-label="กระทบยอดเงินสด">
      <h2 className="text-xl font-semibold">ที่มาของยอดเงินสด</h2>
      <dl className="grid grid-cols-2 gap-2">
        <dt>เงินทอนเริ่มต้น</dt><dd className="text-right">{formatBaht(shift.openingFloatSatang)}</dd>
        <dt>รับเงินสดจากการขาย</dt><dd className="text-right">+{formatBaht(totals.cashSalesSatang)}</dd>
        <dt>จ่ายคืนลูกค้าจริง</dt><dd className="text-right">−{formatBaht(totals.cashRefundsSatang)}</dd>
        <dt>เติมเงินทอน</dt><dd className="text-right">+{formatBaht(totals.topupsSatang)}</dd>
        <dt>เงินสดย่อย</dt><dd className="text-right">−{formatBaht(totals.pettyCashSatang)}</dd>
        <dt>นำเงินออกฝาก</dt><dd className="text-right">−{formatBaht(totals.depositsSatang)}</dd>
        <dt className="font-semibold">ยอดตามรายการเงินสด</dt><dd className="text-right font-semibold">{formatBaht(statement.ledgerCashSatang)}</dd>
      </dl>
      <p className="text-sm">รวมรายการทุกหน้า ไม่นับพร้อมเพย์หรือการอนุมัติคืนเงินที่ยังไม่จ่าย เงินสดที่รับจากบิลยกเลิกในอดีตยังนับจนกว่าจะมีการจ่ายคืนจริง</p>
      {shift.closedAt ? <p className="font-semibold">ยอดที่บันทึกตอนปิด {formatBaht(shift.expectedCashSatang)} · นับได้ {formatBaht(shift.countedCashSatang ?? 0)} · ส่วนต่าง {formatBaht(shift.differenceSatang ?? 0)}</p> : null}
      {statement.snapshotDifferenceSatang !== null && statement.snapshotDifferenceSatang !== 0 ? <p role="alert" className="rounded bg-amber-100 p-3 text-amber-950">
        รายการเงินสดไม่ตรงกับยอดที่บันทึกตอนปิดกะ ต่างกัน {formatBaht(statement.snapshotDifferenceSatang)} กรุณาให้ผู้จัดการตรวจสอบ ยอดปิดกะเดิมไม่ได้ถูกเปลี่ยน
      </p> : null}
    </section>
    <section className="space-y-3" aria-label="รายการเงินสด">
      <h2 className="text-xl font-semibold">รายการล่าสุด · {statement.entryCount} รายการ</h2>
      {statement.entries.map(entry => <article key={`${entry.kind}:${entry.id}`} className="space-y-1 rounded-xl border bg-white p-4">
        <p className="flex justify-between gap-4 font-semibold"><span>{labels[entry.kind]}</span><span>{entry.amountSatang >= 0 ? '+' : ''}{formatBaht(entry.amountSatang)}</span></p>
        <p>{when(entry.occurredAt)} · โดย {entry.actorName ?? 'ไม่ระบุพนักงาน'}</p>
        {entry.approvedByName ? <p>อนุมัติโดย {entry.approvedByName}</p> : null}
        {entry.reason ? <p>{entry.reason}</p> : null}{entry.reference ? <p>อ้างอิง: {entry.reference}</p> : null}
        {entry.orderId ? <Link href={`/pos/receipt/${entry.orderId}`} className="inline-block py-2 underline">บิล #{entry.dailyNo} · {entry.businessDate}</Link> : null}
      </article>)}
      {statement.entries.length === 0 ? <p>ยังไม่มีรายการเงินสดนอกจากเงินทอนเริ่มต้น</p> : null}
      <nav aria-label="หน้าบัญชีเงินสด" className="flex items-center justify-between gap-4">
        {page.data > 1 ? <Link className="py-3 underline" href={`/pos/shifts/${shiftId}?page=${page.data - 1}`}>หน้าก่อน</Link> : <span />}
        <span>หน้า {page.data} / {pages}</span>
        {page.data < pages ? <Link className="py-3 underline" href={`/pos/shifts/${shiftId}?page=${page.data + 1}`}>หน้าถัดไป</Link> : <span />}
      </nav>
    </section>
  </main>;
}
