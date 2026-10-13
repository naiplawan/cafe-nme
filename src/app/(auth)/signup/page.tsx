import Link from "next/link";
import Image from "next/image";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section data-auth-card className="w-full max-w-md rounded-2xl bg-background p-6 shadow-[0_18px_44px_rgba(59,42,32,0.10)] ring-1 ring-foreground/10 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/assets/logo-mark.png" alt="Cafe'nMe" width={56} height={56} className="mb-4 size-14" />
          <h1 className="text-2xl font-semibold">สร้างบัญชี</h1>
          <p className="mt-2 text-sm text-muted-foreground">เริ่มต้นจัดการร้านของคุณ</p>
          <svg aria-hidden="true" className="mx-auto mt-2 h-2 w-20 text-[#C69C72]" viewBox="0 0 80 4" fill="none"><path data-logo-line d="M1 2H79" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        </div>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          มีบัญชีแล้ว? <Link className="font-medium text-foreground underline" href="/login">เข้าสู่ระบบ</Link>
        </p>
      </section>
    </main>
  );
}
