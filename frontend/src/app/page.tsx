// biome-ignore-all lint/correctness/useUniqueElementIds: the page renders once and its section ids are the targets of the in-page nav links.
import type { Metadata } from "next";
import { Lilita_One, Mitr } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { LANDING_UPDATED, landing, landingJsonLd } from "./landing-content";
import { LandingMotion } from "./landing-motion";

// Lilita One has no Thai glyphs: it sets the Latin wordmark and tagline, Mitr sets Thai headings.
const display = Lilita_One({ variable: "--font-landing-display", subsets: ["latin"], weight: "400" });
const thaiHeading = Mitr({ variable: "--font-landing-heading", subsets: ["latin", "thai"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: { absolute: `${landing.title} · ${landing.name}` },
  description: landing.description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { title: `${landing.title} · ${landing.name}`, description: landing.description, url: "/" },
};

// YELO brand kit: deep coffee #4A2C1A, medium roast #6B4226, latte #B88A5A (decoration only, 2.7:1 on cream),
// warm cream #F7F1E7, ink #2F2A25, golden amber #F4B942 (ink text only; white on amber is 1.8:1).
const wordmark = "font-[family-name:var(--font-landing-display)] tracking-wide text-[#4A2C1A]";
const heading = "font-[family-name:var(--font-landing-heading)] text-[#4A2C1A]";
const eyebrow = "inline-flex rounded-full bg-[#F4B942]/25 px-3 py-1 text-sm font-semibold text-[#6B4226]";
const h2 = `${heading} mt-3 text-[clamp(26px,3.4vw,38px)] font-semibold leading-tight`;
const muted = "text-[#6B5E55]";
const card = "rounded-3xl border border-[#E5D8C5] bg-white shadow-[0_2px_10px_rgba(74,44,26,.05)]";
const primaryButton = "inline-flex min-h-[46px] items-center rounded-2xl bg-[#F4B942] px-6 font-semibold text-[#2F2A25] shadow-[0_6px_14px_rgba(244,185,66,.35)] transition-colors hover:bg-[#EDAF2F]";
const outlineButton = "inline-flex min-h-[46px] items-center rounded-2xl border-[1.5px] border-[#4A2C1A] px-6 font-semibold text-[#4A2C1A] hover:bg-white/60";

const cell = { yes: "✓", no: "—", some: "บางรุ่น" } as const;
const cellLabel = { yes: "มี", no: "ไม่มี", some: "บางรุ่น" } as const;
const cellStyle = { yes: "font-bold text-[#2E7D32]", no: "opacity-45", some: `text-[13px] ${muted}` } as const;
const updatedLabel = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" }).format(new Date(LANDING_UPDATED));

const mockMenu = [
  { name: "Americano", price: 60, image: "/assets/menu/iced-americano.webp" },
  { name: "Cappuccino", price: 70, image: "/assets/menu/cappuccino.webp" },
  { name: "Mocha", price: 75, image: "/assets/menu/iced-mocha.webp" },
  { name: "Croissant", price: 55, image: "/assets/menu/butter-croissant.webp" },
];
const mockOrder = [{ name: "Cappuccino", price: 70 }, { name: "Americano", price: 60 }, { name: "Croissant", price: 55 }];
const extraArt = ["/landing/yelo-good-mood.webp", "/landing/yelo-on-my-way.webp"];

function Ticks({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-4 grid gap-2">
      {items.map((item) => (
        <li key={item} className="relative pl-7 leading-relaxed before:absolute before:left-0 before:top-[0.35em] before:size-[18px] before:rounded-full before:bg-[#F4B942] after:absolute after:left-[5px] after:top-[0.62em] after:h-[5px] after:w-2 after:-rotate-45 after:border-b-2 after:border-l-2 after:border-[#2F2A25]">
          {item}
        </li>
      ))}
    </ul>
  );
}

// A static picture of the POS in the brand-kit style; decorative, so screen readers skip it.
function PosMock() {
  return (
    <div aria-hidden data-motion="mock" className="grid grid-cols-[64px_1fr] overflow-hidden rounded-[22px] border border-[#E5D8C5] bg-white text-[#2F2A25] shadow-[0_30px_60px_-24px_rgba(74,44,26,.45)] sm:grid-cols-[84px_1fr]">
      <div className="flex flex-col items-center gap-2 bg-[#4A2C1A] px-1.5 py-3 text-[10px] text-[#E7D6C0]">
        <Image src="/assets/yelo-coffee-mascot.png" alt="" width={44} height={44} className="mb-1 size-10 object-contain" />
        <span className="w-full rounded-lg bg-[#F4B942] py-1.5 text-center font-semibold text-[#2F2A25]">POS</span>
        {["ออเดอร์", "เมนู", "สต็อก", "สมาชิก", "รายงาน"].map((item) => <span key={item} className="w-full py-1 text-center">{item}</span>)}
      </div>
      <div className="grid min-w-0 gap-3 p-3 sm:grid-cols-[1fr_150px]">
        <div className="min-w-0">
          <div className="flex gap-1.5 text-[10px]">
            {["ทั้งหมด", "กาแฟ", "ไม่ใช่กาแฟ", "ขนม"].map((item, index) => (
              <span key={item} className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${index === 0 ? "bg-[#F4B942]" : "border border-[#E5D8C5]"}`}>{item}</span>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {mockMenu.map((item) => (
              <div key={item.name} data-motion="mock-card" className="rounded-xl border border-[#EFE5D6] p-1.5">
                <div className="grid h-16 place-items-center rounded-lg bg-[#FBF8F1]">
                  <Image src={item.image} alt="" width={64} height={64} className="size-14 object-contain" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  <span className="truncate font-semibold">{item.name}</span>
                  <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[#F4B942] font-bold">+</span>
                </div>
                <span className="text-[10px] text-[#6B5E55]">฿{item.price}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[9px] font-medium">
            <span className="rounded-full bg-[#E8F3E9] px-2 py-0.5 text-[#2E7D32]">● มีของ</span>
            <span className="rounded-full bg-[#FFF2D5] px-2 py-0.5 text-[#8A5A00]">● ใกล้หมด</span>
            <span className="rounded-full bg-[#FCE8E6] px-2 py-0.5 text-[#B3261E]">● หมด</span>
          </div>
        </div>
        <div className="hidden flex-col rounded-xl bg-[#FBF8F1] p-2.5 text-[10px] sm:flex">
          <div className="flex items-center justify-between font-semibold"><span>ออเดอร์ #000123</span><span className="rounded-full bg-[#E8F3E9] px-1.5 text-[9px] text-[#2E7D32]">ทานที่ร้าน</span></div>
          <div className="mt-2 grid gap-1.5 border-t border-[#E5D8C5] pt-2">
            {mockOrder.map((line) => <span key={line.name} data-motion="order-line" className="flex justify-between"><span>{line.name}</span><span>฿{line.price}</span></span>)}
          </div>
          <div data-motion="order-total" className="mt-auto flex justify-between border-t border-[#E5D8C5] pt-2 text-xs font-bold"><span>รวม</span><span>฿185</span></div>
          <span className="mt-2 rounded-lg bg-[#F4B942] py-1.5 text-center font-semibold">ชำระเงิน</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <LandingMotion className={`${display.variable} ${thaiHeading.variable} bg-[#F7F1E7] text-[#2F2A25]`}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD with "<" escaped, as the Next.js JSON-LD guide recommends. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()).replace(/</g, "\\u003c") }} />

      <header className="mx-auto flex h-[72px] max-w-[1140px] items-center gap-5 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/assets/yelo-coffee-mascot.png" alt="" width={44} height={44} className="size-11 object-contain" preload />
          <span className={`${wordmark} text-2xl uppercase leading-none`}>{landing.name}</span>
        </Link>
        <nav aria-label="เมนูหลัก" className="ml-auto hidden gap-6 text-[15px] md:flex">
          {[["#features", "ฟีเจอร์"], ["#how", "วิธีเริ่ม"], ["#compare", "เปรียบเทียบ"], ["#faq", "คำถาม"]].map(([href, label]) => (
            <a key={href} href={href} className="text-[#4A2C1A]/80 hover:text-[#4A2C1A]">{label}</a>
          ))}
        </nav>
        <Link href="/login" className="ml-auto hidden min-h-10 items-center rounded-2xl border-[1.5px] border-[#4A2C1A] px-4 text-sm font-semibold text-[#4A2C1A] sm:inline-flex md:ml-0">เข้าสู่ระบบ</Link>
        <Link href="/signup" className="ml-auto inline-flex min-h-10 items-center rounded-2xl bg-[#F4B942] px-4 text-sm font-semibold text-[#2F2A25] sm:ml-0">สมัครใช้งาน</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1140px] items-center gap-12 px-4 pb-20 pt-8 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className={eyebrow}>สำหรับร้านกาแฟและคาเฟ่ในไทย</p>
            <h1 className={`${heading} mb-3 mt-4 text-[clamp(34px,4.6vw,54px)] font-semibold leading-[1.25]`}>{landing.title}</h1>
            <p className={`${wordmark} relative mb-6 inline-block text-[clamp(22px,2.6vw,30px)] text-[#6B4226]`}>
              Good Coffee, Better Days
              <svg aria-hidden viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-3 w-full overflow-visible">
                <path data-motion="squiggle" d="M3 9 C 40 2, 70 13, 110 7 S 180 2, 220 8 S 275 11, 297 4" fill="none" stroke="#F4B942" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </p>
            <p className={`text-lg leading-[1.75] ${muted}`}>{landing.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={primaryButton}>สมัครใช้งาน</Link>
              <a href="#how" className={outlineButton}>ดูวิธีเริ่มใช้</a>
            </div>
            <ul className={`mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm ${muted}`}>
              {landing.facts.map((fact) => (
                <li key={fact} className="before:mr-2 before:align-middle before:text-[8px] before:text-[#F4B942] before:content-['●']">{fact}</li>
              ))}
            </ul>
          </div>
          <div className="relative pb-14 pl-6 sm:pl-10">
            <PosMock />
            <Image data-motion="mascot" src="/landing/yelo-coffee-break.webp" alt="" width={512} height={512} className="absolute -bottom-2 -left-4 w-[110px] drop-shadow-[0_10px_16px_rgba(74,44,26,.2)] sm:-left-6 sm:w-[150px]" sizes="150px" preload />
          </div>
        </section>

        <section className="mx-4">
          <div data-reveal className={`${card} mx-auto grid max-w-[1000px] items-center gap-8 px-6 py-12 md:grid-cols-[180px_1fr] md:px-12`}>
            <Image data-motion="float" src="/landing/yelo-yumm.webp" alt="" width={512} height={512} className="mx-auto w-[150px] md:w-[180px]" sizes="180px" />
            <div>
              <h2 className={`${heading} text-[clamp(26px,3.4vw,38px)] font-semibold leading-tight`}>{landing.name} คืออะไร?</h2>
              <p className={`mt-4 text-[clamp(17px,2vw,21px)] leading-[1.8] ${muted}`}>{landing.definition}</p>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1140px] scroll-mt-4 px-4 py-20">
          <p className={eyebrow}>ฟีเจอร์</p>
          <h2 className={h2}>{landing.name} ทำอะไรได้บ้าง?</h2>
          {landing.features.map((feature, index) => (
            <div key={feature.title} data-reveal className="grid items-center gap-6 py-11 md:grid-cols-2 md:gap-14">
              <figure className={`overflow-hidden rounded-3xl border border-[#E5D8C5] bg-white p-2 shadow-[0_12px_30px_-18px_rgba(74,44,26,.4)] ${index % 2 ? "md:order-2" : ""} ${feature.image.width < feature.image.height ? "mx-auto max-w-[280px]" : ""}`}>
                <Image src={feature.image.src} alt={feature.image.alt} width={feature.image.width} height={feature.image.height} className="rounded-2xl" sizes="(min-width: 768px) 540px, 100vw" />
              </figure>
              <div>
                <h3 className={`${heading} mb-3 text-[28px] font-semibold`}>{feature.title}</h3>
                <p className={`leading-[1.8] ${muted}`}>{feature.answer}</p>
                <Ticks items={feature.bullets} />
              </div>
            </div>
          ))}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {landing.extras.map((extra, index) => (
              <div key={extra.title} data-reveal className={`${card} flex items-center gap-5 p-6`}>
                <Image data-motion="float" src={extraArt[index % extraArt.length]} alt="" width={512} height={512} className="w-24 shrink-0" sizes="96px" />
                <div>
                  <h3 className={`${heading} mb-2 text-[21px] font-semibold`}>{extra.title}</h3>
                  <p className={`leading-[1.75] ${muted}`}>{extra.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-4 bg-white py-20">
          <div className="mx-auto max-w-[1140px] px-4">
            <p className={eyebrow}>วิธีเริ่ม</p>
            <h2 className={h2}>เริ่มใช้ {landing.name} อย่างไร?</h2>
            <ol className="mt-9 grid gap-5 md:grid-cols-3">
              {landing.steps.map((step, index) => (
                <li key={step.name} data-reveal className="rounded-3xl border border-[#E5D8C5] bg-[#F7F1E7] p-7">
                  <span className={`${wordmark} mb-4 grid size-[46px] place-items-center rounded-2xl bg-[#F4B942] text-2xl text-[#2F2A25]`}>{index + 1}</span>
                  <h3 className={`${heading} mb-1.5 text-xl font-semibold`}>{step.name}</h3>
                  <p className={`leading-[1.7] ${muted}`}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="compare" className="mx-auto max-w-[1140px] scroll-mt-4 px-4 py-20">
          <p className={eyebrow}>เปรียบเทียบ</p>
          <h2 className={`${h2} mb-7`}>ต่างจากเครื่องคิดเงินและบัตรสะสมแต้มกระดาษอย่างไร?</h2>
          <div data-reveal className={`${card} relative overflow-x-auto p-2`}>
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <caption className={`px-3 pb-2.5 pt-2 text-left text-[13px] ${muted}`}>เปรียบเทียบความสามารถหลัก ณ {updatedLabel}</caption>
              <thead>
                <tr className="border-b border-[#E5D8C5]">
                  <th scope="col" className="p-3 text-left text-sm">ความสามารถ</th>
                  {landing.compare.columns.map((column, index) => (
                    <th key={column} scope="col" className={`p-3 text-sm ${index === 0 ? "rounded-t-xl bg-[#F4B942]/25 text-[#4A2C1A]" : ""}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {landing.compare.rows.map((row) => (
                  <tr key={row.label} className="border-b border-[#EFE5D6] last:border-0">
                    <th scope="row" className="p-3 text-left font-medium">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={landing.compare.columns[index]} className={`p-3 text-center ${index === 0 ? "bg-[#F4B942]/25" : ""} ${cellStyle[value]}`}>
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
            <h2 className={`${h2} mb-3`}>คำถามเกี่ยวกับ {landing.name}</h2>
            {landing.faq.map((item, index) => (
              <details key={item.q} open={index === 0} className="group border-b border-[#E5D8C5] py-[18px]">
                <summary className="flex cursor-pointer list-none justify-between gap-4 text-[17px] font-semibold text-[#4A2C1A] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[#F4B942] text-lg leading-none text-[#2F2A25] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className={`mt-2.5 leading-[1.75] ${muted}`}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1140px] px-4 py-20">
          <div data-reveal className="grid items-center gap-6 overflow-hidden rounded-[32px] bg-[#4A2C1A] px-8 py-12 text-center md:grid-cols-[1fr_220px] md:text-left">
            <div>
              <h2 className={`${heading} text-[clamp(26px,3.4vw,38px)] font-semibold leading-tight text-[#F7F1E7]`}>พร้อมเปิดร้านด้วย {landing.name} แล้วหรือยัง?</h2>
              <p className="mb-7 mt-3 max-w-[560px] text-lg text-[#E7D6C0] max-md:mx-auto">สมัคร ตั้งเมนู และจับคู่แท็บเล็ตเครื่องแรกของร้านคุณ</p>
              <Link href="/signup" className={primaryButton}>สมัครใช้งาน</Link>
            </div>
            <Image data-motion="float" src="/landing/yelo-take-a-break.webp" alt="" width={512} height={512} className="mx-auto w-[180px] md:w-[220px]" sizes="220px" />
          </div>
        </section>
      </main>

      <footer className={`border-t border-[#E5D8C5] py-10 text-sm ${muted}`}>
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-4 px-4">
          <span className="flex items-center gap-2">
            <span className={`${wordmark} text-lg uppercase`}>{landing.name}</span>
            <span>· ระบบ POS ร้านกาแฟพร้อมบัตรสะสมแต้ม LINE · © 2026</span>
          </span>
          <span className="text-xs font-medium uppercase tracking-[0.14em]">Simple / Warm / Friendly / Professional</span>
          <span>อัปเดตล่าสุด <time dateTime={LANDING_UPDATED}>{updatedLabel}</time></span>
        </div>
      </footer>
    </LandingMotion>
  );
}
