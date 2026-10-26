import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { findStaffShops } from "@/server/staff-session";
import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10"><p className="text-sm text-muted-foreground">กำลังตรวจสอบบัญชี…</p></main>}>
      <OnboardingPageContent />
    </Suspense>
  );
}

async function OnboardingPageContent() {
  const user = await getUser();
  if (!user) redirect("/login");
  const shops = await findStaffShops(user.id);
  if (shops.length === 1) redirect("/admin");
  if (shops.length > 1) redirect("/select-shop");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section data-auth-card className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-[0_18px_44px_rgba(59,42,32,0.10)] ring-1 ring-foreground/10 sm:p-8">
        <div className="mb-6 text-center">
          <Image src="/assets/yelo-coffee-mascot.png" alt="YELO Coffee" width={56} height={56} className="mx-auto mb-4 size-14" />
          <h1 className="text-2xl font-semibold">ตั้งค่าร้านของคุณ</h1>
          <p className="mt-2 text-sm text-muted-foreground">กรอกข้อมูลเพื่อเริ่มสร้างเมนู</p>
          <svg aria-hidden="true" className="mx-auto mt-2 h-2 w-20 text-[#B88A5A]" viewBox="0 0 80 4" fill="none"><path data-logo-line d="M1 2H79" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        </div>
        <OnboardingForm />
      </section>
    </main>
  );
}
