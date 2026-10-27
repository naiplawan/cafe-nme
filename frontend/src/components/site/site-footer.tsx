import Link from "next/link";
import { LANDING_UPDATED, landingUpdatedLabel } from "@/app/landing-content";
import { SectionCard } from "./section-card";
import { Wordmark } from "./wordmark";

const columns = [
  { title: "หน้าเว็บ", links: [["/#features", "ฟีเจอร์"], ["/#how", "วิธีเริ่ม"], ["/#compare", "เปรียบเทียบ"], ["/#faq", "คำถาม"]] },
  { title: "บัญชี", links: [["/login", "เข้าสู่ระบบ"], ["/signup", "สมัครใช้งาน"]] },
  { title: "ช่วยเหลือ", links: [["/contact", "ติดต่อเรา"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="pb-3 pt-4 md:pb-5">
      <SectionCard tone="espresso" className="px-6 py-14 md:px-12 md:py-16">
        <div className="mx-auto max-w-[1140px]">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Wordmark tone="cream" className="text-[clamp(44px,7vw,84px)]" />
              <p className="mt-4 max-w-xs text-butter">ระบบ POS ร้านกาแฟพร้อมบัตรสะสมแต้ม LINE</p>
            </div>
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="mb-2 text-[14px] font-bold text-amber">{column.title}</p>
                <ul>
                  {column.links.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} className="inline-flex min-h-11 min-w-11 items-center text-cream hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber">{label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-latte pt-6 text-sm text-butter">
            <span>© 2026 YELO Coffee</span>
            <span className="font-bold uppercase tracking-[0.12em]">Simple / Warm / Friendly / Professional</span>
            <span>อัปเดตล่าสุด <time dateTime={LANDING_UPDATED}>{landingUpdatedLabel}</time></span>
          </div>
        </div>
      </SectionCard>
    </footer>
  );
}
