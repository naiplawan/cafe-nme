import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

export default async function NewBranchPage() {
  const session = await requireStaff();
  if (session.staff.role !== "owner") redirect("/admin");

  return (
    <section className="mx-auto max-w-lg rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-8">
      <h1 className="text-2xl font-semibold">เพิ่มสาขา</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">สร้างพื้นที่จัดการแยกสำหรับสาขาใหม่</p>
      <OnboardingForm variant="branch" />
    </section>
  );
}
