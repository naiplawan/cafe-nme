import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePosStaff } from "@/server/pos-session";
import { getAcceptedSelfOrder } from "@/server/self-orders";
import { getProviderPayment } from "@/server/provider-payments";
import type { ProviderPaymentView } from "@/server/provider-payments";
import { ProviderPaymentPanel } from "../../provider-payment-panel";

export const instant = false;
export default async function ProviderPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePosStaff();
  let draft: Awaited<ReturnType<typeof getAcceptedSelfOrder>>;
  let payment: ProviderPaymentView;
  try {
    [draft, payment] = await Promise.all([
      getAcceptedSelfOrder(session.shopId, session.staff.id, id),
      getProviderPayment(session.shopId, session.staff.id, id),
    ]);
  } catch {
    notFound();
  }
  return <main className="min-h-dvh space-y-5 bg-[#F7F1E7] p-5 text-[#4A2C1A]">
    <Link href="/pos/requests" className="underline">กลับรายการจาก QR</Link>
    <h1 className="text-2xl font-bold">รับชำระคำสั่งจาก QR</h1>
    <p>ยอดที่ร้านตรวจสอบจากเมนู: ฿{(draft.totalSatang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
    <ProviderPaymentPanel id={id} initial={payment} />
    <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">วิธีชำระที่ร้านตรวจเอง</h2>
      <p>ใช้เมื่อรับเงินสดหรือยืนยันพร้อมเพย์ด้วยขั้นตอนของร้าน ก่อนออกบิลตรวจยอดกับหลักฐานด้วยตนเอง</p>
      <Link href={`/pos?selfOrderId=${encodeURIComponent(id)}`} className="inline-flex min-h-12 items-center rounded-xl border px-5">ไปหน้าขายและรับชำระเอง</Link>
    </section>
  </main>;
}
