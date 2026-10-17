import Image from "next/image";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section data-auth-card className="w-full max-w-md rounded-2xl bg-background p-6 shadow-[0_18px_44px_rgba(59,42,32,0.10)] ring-1 ring-foreground/10 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/assets/logo-mark.png" alt="Cafe'nMe" width={56} height={56} className="mb-4 size-14" />
          <h1 className="text-2xl font-semibold">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-2 text-sm text-muted-foreground">เลือกรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร</p>
        </div>
        {token.length >= 32 ? <ResetPasswordForm token={token} /> : <div className="space-y-4 text-center"><p role="status" className="text-sm text-destructive">ลิงก์ไม่ถูกต้องหรือไม่มีรหัสสำหรับรีเซ็ต</p><Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">ขอลิงก์ใหม่</Link></div>}
      </section>
    </main>
  );
}
