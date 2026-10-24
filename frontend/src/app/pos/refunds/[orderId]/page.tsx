import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requirePosStaff } from "@/server/pos-session";
import { getRefundDetail } from "@/server/refunds";
import { formatBaht } from "@/lib/money";
import { RefundForm,PayoutForm } from "./forms";
export const instant=false;
export default async function RefundPage({params}:{params:Promise<{orderId:string}>}) {
 const session=await requirePosStaff();
 if(session.staff.role==='barista') {return <main className="p-6"><p>ต้องให้เจ้าของร้านหรือผู้จัดการอนุมัติคืนเงิน</p><Link href="/pos/orders">กลับรายการขาย</Link></main>;}
 const {orderId}=await params;const detail=await getRefundDetail(session.shopId,session.staff.id,orderId);
 return <main className="mx-auto max-w-3xl space-y-6 p-6"><Link href="/pos/orders" className="inline-flex min-h-11 items-center underline">กลับรายการขาย</Link><h1 className="text-2xl font-bold">คืนเงินบางรายการ · บิล #{detail.order.dailyNo}</h1><p>ยอดชำระ {formatBaht(detail.order.totalSatang)}</p>
 <RefundForm detail={detail} requestId={randomUUID()}/><h2 className="text-xl font-semibold">ประวัติคืนเงิน</h2>
 {detail.refunds.map(refund=><article key={refund.id} className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{formatBaht(refund.amountSatang)} · {refund.paidAt?'บันทึกว่าจ่ายคืนแล้ว':'รอจ่ายคืน'}</h3><p>{refund.reason}</p><p>อนุมัติโดย {refund.approvedBy} · {refund.createdAt}</p>{refund.paidAt?<p>ผู้จ่าย {refund.paidBy} · {refund.payoutMethod} · {refund.payoutReference} · {refund.paidAt}</p>:<PayoutForm orderId={orderId} refundId={refund.id}/>}</article>)}
 </main>;
}
