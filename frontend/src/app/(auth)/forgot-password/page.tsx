import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section data-auth-card className="w-full max-w-md rounded-2xl bg-background p-6 shadow-[0_18px_44px_rgba(59,42,32,0.10)] ring-1 ring-foreground/10 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/assets/logo-mark.png" alt="Cafe'nMe" width={56} height={56} className="mb-4 size-14" />
          <h1 className="text-2xl font-semibold">ลืมรหัสผ่าน</h1>
          <p className="mt-2 text-sm text-muted-foreground">กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้</p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-foreground underline underline-offset-4">กลับไปเข้าสู่ระบบ</Link></p>
      </section>
    </main>
  );
}
