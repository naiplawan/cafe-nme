// biome-ignore-all lint/correctness/useUniqueElementIds: the page renders once and its section ids are the targets of the in-page nav links.
import type { Metadata } from "next";
import Image from "next/image";
import { displayFont } from "@/components/site/display-font";
import { Marquee } from "@/components/site/marquee";
import { PillLink } from "@/components/site/pill";
import { SectionCard } from "@/components/site/section-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Sticker, TiltLabel } from "@/components/site/sticker";
import { landing, landingJsonLd, landingUpdatedLabel } from "./landing-content";
import { LandingMotion } from "./landing-motion";

export const metadata: Metadata = {
  title: { absolute: `${landing.title} · ${landing.name}` },
  description: landing.description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { title: `${landing.title} · ${landing.name}`, description: landing.description, url: "/" },
};

// Colours, radii and the display face come from the YELO design system tokens in globals.css.
const h2 = "font-display-condensed mt-3 text-[clamp(28px,3.6vw,44px)] leading-[1.25] text-espresso";
const h3 = "font-display-condensed text-espresso";
const muted = "text-muted-ink";
const card = "rounded-card border-[1.5px] border-line bg-white";

const cell = { yes: "✓", no: "—", some: "บางรุ่น" } as const;
const cellLabel = { yes: "มี", no: "ไม่มี", some: "บางรุ่น" } as const;
const cellStyle = { yes: "font-bold text-leaf", no: "opacity-45", some: `text-[13px] ${muted}` } as const;

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
        <li key={item} className="relative pl-7 leading-relaxed before:absolute before:left-0 before:top-[0.35em] before:size-[18px] before:rounded-full before:bg-amber after:absolute after:left-[5px] after:top-[0.62em] after:h-[5px] after:w-2 after:-rotate-45 after:border-b-2 after:border-l-2 after:border-ink">
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
    <LandingMotion className={`${displayFont.variable} bg-cream text-ink`}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD with "<" escaped, as the Next.js JSON-LD guide recommends. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()).replace(/</g, "\\u003c") }} />

      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-[1140px] items-center gap-12 px-4 pb-10 pt-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <Sticker>สำหรับร้านกาแฟและคาเฟ่ในไทย</Sticker>
            <h1 className="font-display-condensed text-balance mb-5 mt-5 text-[clamp(40px,5.4vw,72px)] leading-[1.2] text-espresso">{landing.title}</h1>
            <TiltLabel>{landing.tagline}</TiltLabel>
            <p className={`mt-8 text-[17px] leading-[1.75] ${muted}`}>{landing.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PillLink href="/signup">สมัครใช้งาน</PillLink>
              <PillLink href="#how" variant="outline">ดูวิธีเริ่มใช้</PillLink>
            </div>
            <ul className={`mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm ${muted}`}>
              {landing.facts.map((fact) => (
                <li key={fact} className="before:mr-2 before:align-middle before:text-[8px] before:text-amber before:content-['●']">{fact}</li>
              ))}
            </ul>
          </div>
          <div className="relative pb-14 pl-6 sm:pl-10">
            <PosMock />
            <Image data-motion="mascot" src="/landing/yelo-coffee-break.webp" alt="" width={512} height={512} className="absolute -bottom-2 -left-4 w-[110px] drop-shadow-[0_10px_16px_rgb(74_44_26/0.2)] sm:-left-6 sm:w-[150px]" sizes="150px" preload />
          </div>
        </section>

        <Marquee words={landing.marquee.features} tone="amber" />

        <SectionCard tone="caramel" className="mt-4">
          <div data-reveal className="mx-auto grid max-w-[1000px] items-center gap-8 px-6 py-14 md:grid-cols-[180px_1fr] md:px-12 md:py-20">
            <Image data-motion="float" src="/landing/yelo-yumm.webp" alt="" width={512} height={512} className="mx-auto w-[150px] md:w-[180px]" sizes="180px" />
            <div>
              <h2 className="font-display-condensed text-[clamp(28px,3.6vw,44px)] leading-[1.25]">{landing.name} คืออะไร?</h2>
              <p className="mt-4 text-[clamp(17px,2vw,21px)] leading-[1.8]">{landing.definition}</p>
            </div>
          </div>
        </SectionCard>

        <section id="features" className="mx-auto max-w-[1140px] scroll-mt-4 px-4 py-20 md:py-28">
          <Sticker tone="amber">ฟีเจอร์</Sticker>
          <h2 className={h2}>{landing.name} ทำอะไรได้บ้าง?</h2>
          {landing.features.map((feature, index) => (
            <div key={feature.title} data-reveal className="grid items-center gap-6 py-11 md:grid-cols-2 md:gap-14">
              <figure className={`overflow-hidden rounded-card border-[1.5px] border-line bg-white p-2 shadow-soft ${index % 2 ? "md:order-2" : ""} ${feature.image.width < feature.image.height ? "mx-auto max-w-[280px]" : ""}`}>
                <Image src={feature.image.src} alt={feature.image.alt} width={feature.image.width} height={feature.image.height} className="rounded-2xl" sizes="(min-width: 768px) 540px, 100vw" />
              </figure>
              <div>
                <h3 className={`${h3} mb-3 text-[clamp(24px,2.6vw,32px)] leading-[1.25]`}>{feature.title}</h3>
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
                  <h3 className={`${h3} mb-2 text-[22px] leading-[1.25]`}>{extra.title}</h3>
                  <p className={`leading-[1.75] ${muted}`}>{extra.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <SectionCard tone="butter" id="how">
          <div aria-hidden className="bg-checker-amber h-6" />
          <div className="mx-auto max-w-[1140px] px-4 py-16 md:py-24">
            <Sticker>วิธีเริ่ม</Sticker>
            <h2 className={h2}>เริ่มใช้ {landing.name} อย่างไร?</h2>
            <ol className="mt-9 grid gap-5 md:grid-cols-3">
              {landing.steps.map((step, index) => (
                <li key={step.name} data-reveal className={`${card} p-7`}>
                  <span className="font-display-condensed mb-4 grid size-[52px] place-items-center rounded-full bg-amber text-2xl text-ink">{index + 1}</span>
                  <h3 className={`${h3} mb-1.5 text-[22px] leading-[1.25]`}>{step.name}</h3>
                  <p className={`leading-[1.7] ${muted}`}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </SectionCard>

        <section id="compare" className="mx-auto max-w-[1140px] scroll-mt-4 px-4 py-20 md:py-28">
          <Sticker tone="amber">เปรียบเทียบ</Sticker>
          <h2 className={`${h2} mb-7`}>ต่างจากเครื่องคิดเงินและบัตรสะสมแต้มกระดาษอย่างไร?</h2>
          <div data-reveal className={`${card} relative overflow-x-auto p-2`}>
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <caption className={`px-3 pb-2.5 pt-2 text-left text-[13px] ${muted}`}>เปรียบเทียบความสามารถหลัก ณ {landingUpdatedLabel}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="p-3 text-left text-sm">ความสามารถ</th>
                  {landing.compare.columns.map((column, index) => (
                    <th key={column} scope="col" className={`p-3 text-sm ${index === 0 ? "rounded-t-xl bg-amber/25 text-espresso" : ""}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {landing.compare.rows.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <th scope="row" className="p-3 text-left font-medium">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={landing.compare.columns[index]} className={`p-3 text-center ${index === 0 ? "bg-amber/25" : ""} ${cellStyle[value]}`}>
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

        <section id="faq" className="mx-auto max-w-[860px] scroll-mt-4 px-4 pb-20 md:pb-28">
          <Sticker>คำถามที่พบบ่อย</Sticker>
          <h2 className={`${h2} mb-8`}>คำถามเกี่ยวกับ {landing.name}</h2>
          <div className="grid gap-3">
            {landing.faq.map((item, index) => (
              <details key={item.q} open={index === 0} className="group rounded-[28px] border-[1.5px] border-line bg-white px-6 py-1 open:bg-butter">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-full text-[17px] font-bold text-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-amber text-lg leading-none text-ink transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className={`pb-4 pt-1 leading-[1.75] ${muted}`}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <Marquee words={landing.marquee.brand} tone="blush" reverse />

        <SectionCard tone="espresso" className="mt-4">
          <div data-reveal className="mx-auto grid max-w-[1000px] items-center gap-6 px-6 py-14 text-center md:grid-cols-[1fr_220px] md:px-12 md:py-20 md:text-left">
            <div>
              <h2 className="font-display-condensed text-[clamp(28px,3.6vw,44px)] leading-[1.25]">พร้อมเปิดร้านด้วย {landing.name} แล้วหรือยัง?</h2>
              <p className="mb-7 mt-3 max-w-[560px] text-lg text-butter max-md:mx-auto">สมัคร ตั้งเมนู และจับคู่แท็บเล็ตเครื่องแรกของร้านคุณ</p>
              <PillLink href="/signup">สมัครใช้งาน</PillLink>
            </div>
            <Image data-motion="float" src="/landing/yelo-take-a-break.webp" alt="" width={512} height={512} className="mx-auto w-[180px] md:w-[220px]" sizes="220px" />
          </div>
        </SectionCard>
      </main>

      <SiteFooter />
    </LandingMotion>
  );
}
