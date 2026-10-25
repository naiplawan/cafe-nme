import { SITE_URL } from "@/lib/site";

// One source for the landing page copy and its JSON-LD, so the FAQ and steps search engines read
// always match what visitors see. Keep claims to features that exist in the product.
export const LANDING_UPDATED = "2026-10-24";

export const landing = {
  name: "Cafe'nMe",
  title: "ระบบ POS ร้านกาแฟ พร้อมบัตรสะสมแต้มบน LINE",
  description:
    "Cafe'nMe ระบบขายหน้าร้านสำหรับร้านกาแฟไทย ขายบนแท็บเล็ต รับเงินสดและพร้อมเพย์ QR ลูกค้าสะสมแต้มผ่าน LINE OA ของร้าน เจ้าของดูยอดขายและรายงานได้จากเว็บ",
  sub: "ขายหน้าร้านบนแท็บเล็ต รับเงินสดหรือพร้อมเพย์ QR ลูกค้าสะสมแต้มผ่าน LINE Official Account ของร้าน และเจ้าของร้านดูยอดขายได้จากทุกที่",
  definition:
    "Cafe'nMe คือระบบขายหน้าร้าน (POS) สำหรับร้านกาแฟไทย ที่รวมบัตรสะสมแต้มสมาชิกบน LINE ไว้ในระบบเดียว พนักงานขายบนแท็บเล็ต เจ้าของร้านจัดการเมนูและดูรายงานผ่านเว็บ ส่วนลูกค้าสะสมแต้มและแลกเครื่องดื่มฟรีผ่าน LINE OA ของร้าน",
  facts: ["จับคู่แท็บเล็ตด้วยรหัส 6 หลัก", "พร้อมเพย์ QR ใส่ยอดอัตโนมัติ", "ใบเสร็จ 58 มม.", "รองรับ PDPA"],
  features: [
    {
      title: "ขายหน้าร้านบนแท็บเล็ต",
      image: { src: "/landing/pos-sale.webp", width: 1280, height: 800, alt: "หน้าจอขาย POS บนแท็บเล็ต แสดงเมนูมีรูปและตะกร้าสินค้า" },
      answer: "จับคู่แท็บเล็ตด้วยรหัส 6 หลักหรือ QR พนักงานเข้าด้วย PIN แล้วขายจากเมนูที่มีรูป ค้นหาและแยกหมวดได้",
      bullets: [
        "ตัวเลือกเพิ่ม: ความหวาน ร้อน/เย็น นม เพิ่มช็อต",
        "ปุ่ม “หมด” แตะครั้งเดียว และเปิดขายเองในวันถัดไปได้",
        "ยกเลิกบิลต้องใช้ PIN ผู้จัดการ",
        "ใบเสร็จขนาด 58 มม.",
      ],
    },
    {
      title: "รับเงินสดและพร้อมเพย์ QR",
      image: { src: "/landing/pos-promptpay.webp", width: 1280, height: 800, alt: "หน้าจอชำระเงินด้วยพร้อมเพย์ QR ที่ใส่ยอดเงินแล้ว" },
      answer: "QR พร้อมเพย์สร้างพร้อมยอดเงินของบิลนั้น ลูกค้าสแกนจ่ายได้ทันทีโดยไม่ต้องพิมพ์ยอดเอง ส่วนเงินสดมีปุ่มจำนวนเงินด่วน",
      bullets: ["ปุ่มจำนวนเงินสดที่คำนวณจากยอดบิล", "QR ใส่ยอดอัตโนมัติ ลดการโอนผิดยอด"],
    },
    {
      title: "บัตรสะสมแต้มบน LINE",
      image: { src: "/landing/liff-card.webp", width: 500, height: 844, alt: "บัตรสมาชิกใน LINE แสดง QR และความคืบหน้าการสะสมแต้ม" },
      answer: "ลูกค้าเปิดบัตรสมาชิกจาก Rich menu ใน LINE OA ของร้าน แสดง QR ที่หมุนเปลี่ยนเพื่อความปลอดภัย แต้มและรางวัลเครื่องดื่มฟรีคำนวณให้อัตโนมัติ",
      bullets: [
        "สแกน QR สมาชิกหรือค้นหาด้วยเบอร์โทรที่ POS",
        "Rich menu: บัตรสมาชิก แต้มของฉัน เมนู สมัครสมาชิก ติดต่อร้าน",
        "ขอความยินยอม PDPA และลูกค้าลบข้อมูลตัวเองได้",
      ],
    },
    {
      title: "แดชบอร์ดและรายงานยอดขาย",
      image: { src: "/landing/admin-dashboard.webp", width: 1440, height: 900, alt: "แดชบอร์ดผู้ดูแลแสดงกราฟยอดขาย" },
      answer: "ดูยอดขายรายวันและรายชั่วโมง หมวดหมู่ เมนูขายดี สัดส่วนการชำระเงิน และสมาชิก พร้อมส่งออกเป็น CSV",
      bullets: ["กราฟยอดขายและชั่วโมงขายดี", "ส่งออก CSV ไปใช้ต่อในบัญชี", "จัดการพนักงาน สิทธิ์ และอุปกรณ์ POS"],
    },
  ],
  extras: [
    { title: "แบรนด์ของร้านเอง", answer: "ใส่โลโก้และสีของร้านครั้งเดียว แล้วไปปรากฏบนบัตรสมาชิก ตราปั๊ม ใบเสร็จ และ Rich menu ที่ระบบสร้างให้" },
    { title: "ตั้งร้านได้เร็ว", answer: "มีเช็กลิสต์สำหรับร้านใหม่ รูปเมนูสำเร็จรูป 30 รูป และชุดตัวเลือกเพิ่มมาตรฐานที่ผูกกับหลายเมนูได้ในครั้งเดียว" },
  ],
  steps: [
    { name: "สมัครและสร้างร้าน", text: "สมัครด้วยอีเมล ยืนยันตัวตน แล้วทำตามเช็กลิสต์ตั้งร้าน" },
    { name: "ตั้งเมนูและราคา", text: "เลือกรูปจากคลัง 30 รูป เพิ่มหมวดหมู่ และใช้ชุดตัวเลือกเพิ่มมาตรฐาน" },
    { name: "จับคู่แท็บเล็ตแล้วเริ่มขาย", text: "ใส่รหัส 6 หลักหรือสแกน QR บนแท็บเล็ต พนักงานเข้าด้วย PIN แล้วเปิดขายได้เลย" },
  ],
  compare: {
    columns: ["Cafe'nMe", "เครื่องคิดเงินทั่วไป", "บัตรสะสมแต้มกระดาษ"],
    rows: [
      { label: "พร้อมเพย์ QR พร้อมยอดเงิน", values: ["yes", "some", "no"] },
      { label: "สะสมแต้มอัตโนมัติ ไม่ต้องปั๊มมือ", values: ["yes", "no", "no"] },
      { label: "ลูกค้าไม่ต้องพกบัตร", values: ["yes", "no", "no"] },
      { label: "รายงานยอดขายรายชั่วโมงและเมนูขายดี", values: ["yes", "some", "no"] },
      { label: "ส่งออกข้อมูลเป็น CSV", values: ["yes", "some", "no"] },
      { label: "โลโก้และสีของร้านบนบัตรสมาชิก", values: ["yes", "no", "yes"] },
    ],
  },
  faq: [
    { q: "Cafe'nMe คืออะไร?", a: "Cafe'nMe คือระบบ POS สำหรับร้านกาแฟไทยที่มีบัตรสะสมแต้มบน LINE ในตัว ใช้ขายหน้าร้านบนแท็บเล็ต จัดการร้านผ่านเว็บ และให้ลูกค้าสะสมแต้มผ่าน LINE OA ของร้าน" },
    { q: "ต้องมี LINE Official Account ก่อนไหม?", a: "ไม่ต้องสำหรับการขายหน้าร้าน ระบบ POS ใช้ได้ทันที แต่ถ้าต้องการบัตรสะสมแต้มให้ลูกค้า ต้องเชื่อม LINE OA ของร้านในหน้าตั้งค่า LINE" },
    { q: "ใช้กับอุปกรณ์อะไรได้บ้าง?", a: "หน้า POS ออกแบบสำหรับแท็บเล็ตจอสัมผัสและใช้งานผ่านเบราว์เซอร์ หน้าผู้ดูแลใช้ได้บนคอมพิวเตอร์และมือถือ ลูกค้าใช้บัตรสมาชิกผ่านแอป LINE" },
    { q: "รับชำระเงินแบบไหนได้บ้าง?", a: "รับเงินสดพร้อมปุ่มจำนวนเงินด่วน และพร้อมเพย์ QR ที่ใส่ยอดเงินของบิลให้อัตโนมัติ" },
    { q: "ลูกค้าสะสมแต้มอย่างไร?", a: "ลูกค้าแสดง QR บัตรสมาชิกใน LINE หรือบอกเบอร์โทร พนักงานสแกนหรือค้นหาที่ POS แล้วระบบเพิ่มแต้มและแลกเครื่องดื่มฟรีให้อัตโนมัติ" },
    { q: "ข้อมูลลูกค้าเป็นไปตาม PDPA ไหม?", a: "ระบบขอความยินยอมจากลูกค้าก่อนสมัครสมาชิก และลูกค้าลบข้อมูลของตัวเองได้จากบัตรสมาชิกใน LINE" },
    { q: "พิมพ์ใบเสร็จได้ไหม?", a: "ได้ ระบบออกใบเสร็จขนาด 58 มม. พร้อมโลโก้ของร้าน" },
    { q: "ถ้าขายผิดต้องทำอย่างไร?", a: "ยกเลิกบิลได้จากรายการออร์เดอร์วันนี้ โดยต้องใส่ PIN ของผู้จัดการทุกครั้ง" },
  ],
} as const;

export function landingJsonLd() {
  const org = `${SITE_URL}/#org`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": org, name: landing.name, url: SITE_URL, logo: `${SITE_URL}/assets/logo-mark.png` },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: landing.name, inLanguage: "th-TH", publisher: { "@id": org } },
      {
        "@type": "SoftwareApplication",
        name: landing.name,
        description: landing.definition,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Point of Sale",
        operatingSystem: "Web browser, LINE",
        inLanguage: "th-TH",
        featureList: [...landing.features, ...landing.extras].map((feature) => feature.title),
        screenshot: landing.features.map((feature) => `${SITE_URL}${feature.image.src}`),
        publisher: { "@id": org },
        dateModified: LANDING_UPDATED,
      },
      {
        "@type": "FAQPage",
        mainEntity: landing.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
      },
      {
        "@type": "HowTo",
        name: "เริ่มใช้ Cafe'nMe ในร้านกาแฟ",
        step: landing.steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.name, text: step.text })),
      },
    ],
  };
}
