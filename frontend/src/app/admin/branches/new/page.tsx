import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

export default async function NewBranchPage() {
  const session = await requireStaff();
  if (session.staff.role !== "owner") redirect("/admin");

  return (
    <section className="mx-auto max-w-lg rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-8">
      <h1 className="text-2xl font-semibold">เพิ่มสาขา</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">สร้างสาขาใหม่ภายใต้บัญชีเจ้าของเดิมของคุณ</p>
      <div role="note" className="my-5 flex gap-3 rounded-xl border border-border bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>เมนู พนักงาน เครื่อง POS และการตั้งค่าจะเริ่มแยกสำหรับสาขานี้ บัญชีแอดมินของคุณยังใช้ได้ทุกสาขา</p>
      </div>
      <OnboardingForm variant="branch" />
    </section>
  );
}
