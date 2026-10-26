import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { AuthShowcase } from "../auth-showcase";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-8 lg:px-10">
      <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(400px,448px)] lg:gap-12 xl:gap-16">
        <AuthShowcase />
        <section data-auth-card className="mx-auto w-full max-w-md rounded-2xl bg-background p-6 shadow-[0_18px_44px_rgba(59,42,32,0.10)] ring-1 ring-foreground/10 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/assets/yelo-coffee-mascot.png" alt="YELO Coffee" width={56} height={56} className="mb-4 size-14" />
          <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-muted-foreground">จัดการร้านและเมนูของคุณ</p>
          <svg aria-hidden="true" className="mx-auto mt-2 h-2 w-20 text-[#B88A5A]" viewBox="0 0 80 4" fill="none"><path data-logo-line d="M1 2H79" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        </div>
        <LoginForm />
        <Link className="mt-4 block text-center text-sm underline" href="/forgot-password">ลืมรหัสผ่าน?</Link>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ยังไม่มีบัญชี? <Link className="font-medium text-foreground underline" href="/signup">สมัครสมาชิก</Link>
        </p>
        </section>
      </div>
    </main>
  );
}
