import { requireStaff } from "@/lib/auth";
import { listAdminStaff } from "@/server/pos-session";
import { AddStaffForm, StaffRow } from "./forms";
import { AdminPageHeader } from "../_components/page-header";
import { AdminAccessDenied } from "../_components/access-denied";

export default async function StaffPage() {
  const session = await requireStaff();
  if (session.staff.role !== "owner" && session.staff.role !== "manager") {
    return <AdminAccessDenied message="ต้องใช้บัญชีเจ้าของร้านหรือผู้จัดการเพื่อจัดการพนักงาน" />;
  }
  const rows = await listAdminStaff(session.shopId, session.staff.id);
  return <div className="space-y-6">
    <AdminPageHeader section="ทีม" title="พนักงาน" description="จัดการบทบาทและ PIN สำหรับเข้าใช้งาน POS" />
    {session.staff.role === "owner" && rows.some((row) => row.role === "owner" && !row.hasPin) && <div role="status" className="rounded-xl border-2 border-primary bg-primary/10 p-4 text-base font-semibold text-foreground">ตั้ง PIN เพื่อเข้าหน้าขาย POS</div>}
    <AddStaffForm currentStaffRole={session.staff.role} />
    <section aria-label="รายชื่อพนักงาน" className="grid gap-3 lg:grid-cols-2">
      {rows.map((row) => <StaffRow key={row.id} currentStaffId={session.staff.id} currentStaffRole={session.staff.role} row={row} />)}
    </section>
  </div>;
}
