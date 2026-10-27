import type { Metadata } from "next";
import Image from "next/image";
import { displayFont } from "@/components/site/display-font";
import { PillLink } from "@/components/site/pill";
import { SectionCard } from "@/components/site/section-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TiltLabel } from "@/components/site/sticker";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "ส่งข้อความถึงทีม YELO Coffee ระบบ POS ร้านกาแฟพร้อมบัตรสะสมแต้มบน LINE",
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
  openGraph: { title: "ติดต่อเรา · YELO Coffee", url: "/contact" },
};

export default function ContactPage() {
  return (
    <div className={`${displayFont.variable} bg-cream text-ink`}>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-[1140px] gap-12 px-4 pb-20 pt-12 md:pb-28 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h1 className="font-display-condensed text-[clamp(44px,7vw,96px)] leading-[1.2] text-espresso">กรอกฟอร์ม</h1>
            <TiltLabel className="mb-12 mt-1">เพื่อติดต่อเรา</TiltLabel>
            <ContactForm />
          </div>
          <aside className="lg:pt-6">
            <div className="rounded-card bg-butter p-8 text-center text-espresso">
              <Image src="/landing/yelo-on-my-way.webp" alt="" width={512} height={512} className="mx-auto w-[180px]" sizes="180px" />
              <h2 className="font-display-condensed mt-4 text-[clamp(26px,3vw,36px)] leading-[1.25]">ส่งข้อความถึงทีม YELO</h2>
              <p className="mt-3 leading-[1.7]">บอกเราว่าร้านของคุณต้องการอะไร ทีมงานจะติดต่อกลับทางอีเมลที่คุณกรอก</p>
            </div>
          </aside>
        </section>

        <SectionCard tone="espresso">
          <div className="mx-auto grid max-w-[1000px] items-center gap-6 px-6 py-14 text-center md:grid-cols-[1fr_220px] md:px-12 md:py-20 md:text-left">
            <div>
              <h2 className="font-display-condensed text-[clamp(28px,3.6vw,44px)] leading-[1.25]">พร้อมเปิดร้านด้วย YELO Coffee แล้วหรือยัง?</h2>
              <p className="mb-7 mt-3 max-w-[560px] text-lg text-butter max-md:mx-auto">สมัคร ตั้งเมนู และจับคู่แท็บเล็ตเครื่องแรกของร้านคุณ</p>
              <PillLink href="/signup">สมัครใช้งาน</PillLink>
            </div>
            <Image src="/landing/yelo-take-a-break.webp" alt="" width={512} height={512} className="mx-auto w-[180px] md:w-[220px]" sizes="220px" />
          </div>
        </SectionCard>
      </main>
      <SiteFooter />
    </div>
  );
}
