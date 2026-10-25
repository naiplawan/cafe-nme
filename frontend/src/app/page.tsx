// biome-ignore-all lint/correctness/useUniqueElementIds: the page renders once and its section ids are the targets of the in-page nav links.
import type { Metadata } from "next";
import { Noto_Serif_Thai } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { LANDING_UPDATED, landing, landingJsonLd } from "./landing-content";

const serif = Noto_Serif_Thai({ variable: "--font-landing-serif", subsets: ["latin", "thai"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: { absolute: `${landing.title} · ${landing.name}` },
  description: landing.description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { title: `${landing.title} · ${landing.name}`, description: landing.description, url: "/" },
};

const heading = "font-[family-name:var(--font-landing-serif)]";
const eyebrow = "text-sm font-semibold text-[#B4441C]";
const h2 = `${heading} text-[clamp(26px,3.4vw,38px)] font-bold leading-tight`;
const muted = "text-[#6B5E55]";
const card = "rounded-2xl border border-[#EADFD3] bg-white";

const cell = { yes: "✓", no: "—", some: "บางรุ่น" } as const;
const cellLabel = { yes: "มี", no: "ไม่มี", some: "บางรุ่น" } as const;
const cellStyle = { yes: "font-bold text-[#2F7D4A]", no: "opacity-45", some: `text-[13px] ${muted}` } as const;
const updatedLabel = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" }).format(new Date(LANDING_UPDATED));

function Ticks({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-4 grid gap-2">
      {items.map((item) => (
        <li key={item} className="relative pl-6 leading-relaxed before:absolute before:left-0.5 before:top-[0.55em] before:h-[7px] before:w-3 before:-rotate-45 before:border-b-[2.5px] before:border-l-[2.5px] before:border-[#B4441C]">
          {item}
        </li>
      ))}
    </ul>
  );
}

// Signed-in users go straight to the app. The session read streams behind Suspense so the landing
// page stays in the static shell, and an auth API failure shows the landing page instead of an error.
async function SignedInRedirect() {
  const user = await getUser().catch(() => null);
  if (user) redirect("/admin");
  return null;
}

export default function LandingPage() {
  return (
    <div className={`${serif.variable} bg-[#FBF6EF] text-[#1E1A17]`}>
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD with "<" escaped, as the Next.js JSON-LD guide recommends. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()).replace(/</g, "\\u003c") }} />

      <header className="mx-auto flex h-[68px] max-w-[1140px] items-center gap-5 px-4">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold">
          <Image src="/assets/logo-mark.png" alt="" width={34} height={34} className="size-[34px] rounded-lg" preload />
          {landing.name}
        </Link>
        <nav aria-label="เมนูหลัก" className="ml-auto hidden gap-6 text-[15px] md:flex">
          {[["#features", "ฟีเจอร์"], ["#how", "วิธีเริ่ม"], ["#compare", "เปรียบเทียบ"], ["#faq", "คำถาม"]].map(([href, label]) => (
            <a key={href} href={href} className="opacity-80 hover:opacity-100">{label}</a>
          ))}
        </nav>
        <Link href="/login" className="ml-auto hidden min-h-10 items-center rounded-xl border-[1.5px] border-[#1E1A17] px-4 text-sm font-semibold sm:inline-flex md:ml-0">เข้าสู่ระบบ</Link>
        <Link href="/signup" className="ml-auto inline-flex min-h-10 items-center rounded-xl bg-[#B4441C] px-4 text-sm font-semibold text-white sm:ml-0">สมัครใช้งาน</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1140px] items-center gap-14 px-4 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className={eyebrow}>สำหรับร้านกาแฟและคาเฟ่ในไทย</p>
            <h1 className={`${heading} mb-5 mt-3.5 text-[clamp(34px,4.8vw,56px)] font-bold leading-[1.2]`}>{landing.title}</h1>
            <p className={`text-lg leading-[1.75] ${muted}`}>{landing.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex min-h-[46px] items-center rounded-xl bg-[#B4441C] px-6 font-semibold text-white">สมัครใช้งาน</Link>
              <a href="#how" className="inline-flex min-h-[46px] items-center rounded-xl border-[1.5px] border-[#1E1A17] px-6 font-semibold">ดูวิธีเริ่มใช้</a>
            </div>
            <ul className={`mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm ${muted}`}>
              {landing.facts.map((fact) => (
                <li key={fact} className="before:mr-2 before:align-middle before:text-[8px] before:text-[#B4441C] before:content-['●']">{fact}</li>
              ))}
            </ul>
          </div>
          <div className="relative pb-10">
            <Image src="/assets/product-latte.png" alt="" width={110} height={110} className="absolute -left-8 -top-8 hidden w-[110px] -rotate-[8deg] drop-shadow-xl lg:block" />
            <div className="rounded-3xl bg-[#1E1A17] p-[11px] shadow-[0_30px_60px_-20px_rgba(30,26,23,.45)]">
              <Image src="/landing/pos-sale.webp" alt="หน้าจอขาย POS ของ Cafe'nMe บนแท็บเล็ต" width={1280} height={800} className="rounded-[13px]" sizes="(min-width: 1024px) 540px, 100vw" preload />
            </div>
            <div className="absolute -bottom-2.5 -right-3 w-[150px] rounded-[30px] bg-[#141110] p-2 shadow-[0_24px_50px_-18px_rgba(0,0,0,.5)]">
              <Image src="/landing/liff-card.webp" alt="บัตรสมาชิก Cafe'nMe ใน LINE" width={500} height={844} className="rounded-[22px]" sizes="150px" />
            </div>
          </div>
        </section>

        <section className="border-y border-[#EADFD3] bg-white py-20">
          <div className="mx-auto max-w-[860px] px-4 text-center">
            <h2 className={h2}>Cafe&apos;nMe คืออะไร?</h2>
            <p className={`${heading} mt-5 text-[clamp(20px,2.4vw,27px)] leading-[1.75]`}>{landing.definition}</p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1140px] scroll-mt-4 px-4 py-20">
          <p className={eyebrow}>ฟีเจอร์</p>
          <h2 className={h2}>Cafe&apos;nMe ทำอะไรได้บ้าง?</h2>
          {landing.features.map((feature, index) => (
            <div key={feature.title} className="grid items-center gap-6 py-11 md:grid-cols-2 md:gap-14">
              <figure className={`overflow-hidden rounded-[14px] border border-black/[.08] ${index % 2 ? "md:order-2" : ""} ${feature.image.width < feature.image.height ? "mx-auto max-w-[280px]" : ""}`}>
                <Image src={feature.image.src} alt={feature.image.alt} width={feature.image.width} height={feature.image.height} sizes="(min-width: 768px) 540px, 100vw" />
              </figure>
              <div>
                <h3 className={`${heading} mb-3 text-[28px] font-bold`}>{feature.title}</h3>
                <p className={`leading-[1.8] ${muted}`}>{feature.answer}</p>
                <Ticks items={feature.bullets} />
              </div>
            </div>
          ))}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {landing.extras.map((extra) => (
              <div key={extra.title} className={`${card} p-6`}>
                <h3 className={`${heading} mb-2 text-[21px] font-bold`}>{extra.title}</h3>
                <p className={`leading-[1.75] ${muted}`}>{extra.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-4 bg-white py-20">
          <div className="mx-auto max-w-[1140px] px-4">
            <p className={eyebrow}>วิธีเริ่ม</p>
            <h2 className={h2}>เริ่มใช้ Cafe&apos;nMe อย่างไร?</h2>
            <ol className="mt-9 grid gap-5 md:grid-cols-3">
              {landing.steps.map((step, index) => (
                <li key={step.name} className={`${card} bg-[#FBF6EF] p-7`}>
                  <span className="mb-4 grid size-[42px] place-items-center rounded-full bg-[#B4441C] font-bold text-white">{index + 1}</span>
                  <h3 className={`${heading} mb-1.5 text-xl font-bold`}>{step.name}</h3>
                  <p className={`leading-[1.7] ${muted}`}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="compare" className="mx-auto max-w-[1140px] scroll-mt-4 px-4 py-20">
          <p className={eyebrow}>เปรียบเทียบ</p>
          <h2 className={`${h2} mb-7`}>ต่างจากเครื่องคิดเงินและบัตรสะสมแต้มกระดาษอย่างไร?</h2>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <caption className={`pb-2.5 text-left text-[13px] ${muted}`}>เปรียบเทียบความสามารถหลัก ณ {updatedLabel}</caption>
              <thead>
                <tr className="border-b border-[#EADFD3]">
                  <th scope="col" className="p-3 text-left text-sm">ความสามารถ</th>
                  {landing.compare.columns.map((column, index) => (
                    <th key={column} scope="col" className={`p-3 text-sm ${index === 0 ? "bg-[#F6E7DC]" : ""}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {landing.compare.rows.map((row) => (
                  <tr key={row.label} className="border-b border-[#EADFD3]">
                    <th scope="row" className="p-3 text-left font-medium">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={landing.compare.columns[index]} className={`p-3 text-center ${index === 0 ? "bg-[#F6E7DC]" : ""} ${cellStyle[value]}`}>
                        <span aria-hidden>{cell[value]}</span>
                        <span className="sr-only">{cellLabel[value]}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="scroll-mt-4 bg-white py-20">
          <div className="mx-auto max-w-[860px] px-4">
            <p className={eyebrow}>คำถามที่พบบ่อย</p>
            <h2 className={`${h2} mb-3`}>คำถามเกี่ยวกับ Cafe&apos;nMe</h2>
            {landing.faq.map((item, index) => (
              <details key={item.q} open={index === 0} className="group border-b border-[#EADFD3] py-[18px]">
                <summary className="flex cursor-pointer list-none justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden className="text-[22px] leading-none text-[#B4441C] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className={`mt-2.5 leading-[1.75] ${muted}`}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1140px] px-4 py-20">
          <div className="rounded-[28px] bg-[#B4441C] px-8 py-14 text-center text-white">
            <h2 className={h2}>พร้อมเปิดร้านด้วย Cafe&apos;nMe แล้วหรือยัง?</h2>
            <p className="mx-auto mb-7 mt-3 max-w-[560px] text-lg text-[#FBE3D6]">สมัคร ตั้งเมนู และจับคู่แท็บเล็ตเครื่องแรกของร้านคุณ</p>
            <Link href="/signup" className="inline-flex min-h-[46px] items-center rounded-xl bg-white px-6 font-semibold text-[#B4441C]">สมัครใช้งาน</Link>
          </div>
        </section>
      </main>

      <footer className={`border-t border-[#EADFD3] py-10 text-sm ${muted}`}>
        <div className="mx-auto flex max-w-[1140px] flex-wrap justify-between gap-4 px-4">
          <span>© 2026 {landing.name} · ระบบ POS ร้านกาแฟพร้อมบัตรสะสมแต้ม LINE</span>
          <span>อัปเดตล่าสุด <time dateTime={LANDING_UPDATED}>{updatedLabel}</time></span>
        </div>
      </footer>
    </div>
  );
}
