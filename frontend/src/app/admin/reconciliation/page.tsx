import { requireStaff } from "@/lib/auth";
import { businessDate } from "@/lib/business-date";
import { listReconciliation } from "@/server/reconciliation";
import { AdminAccessDenied } from "../_components/access-denied";
import { AdminPageHeader } from "../_components/page-header";
import { ReconciliationReport } from "./report";
export const instant=false;
export default async function ReconciliationPage({searchParams}:{searchParams:Promise<{day?:string}>}) {
  const session=await requireStaff();
  if (session.staff.role==="barista") { return <AdminAccessDenied message="เฉพาะเจ้าของร้านหรือผู้จัดการเท่านั้นที่ตรวจยอดได้"/>; }
  const {day=businessDate(new Date())}=await searchParams;
  const rows=await listReconciliation(session.shopId,session.staff.id,day);
  return <section className="space-y-6"><AdminPageHeader section="ยอดขาย" title="ตรวจยอดรับเงินจริง" description="ตรวจเทียบเงินที่รับกับแต่ละบิล การตรวจหน้านี้บันทึกโดยพนักงาน ไม่ใช่การยืนยันจากธนาคาร"/>
    <form className="flex items-end gap-3"><label className="grid gap-1">วันที่ขาย<input aria-label="วันที่ขาย" type="date" name="day" defaultValue={day} required className="min-h-11 rounded-lg border px-3"/></label><button className="min-h-11 rounded-lg border px-4" type="submit">ดูยอด</button></form>
    <ReconciliationReport rows={rows}/></section>;
}
