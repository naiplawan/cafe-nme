import Image from 'next/image';
import { ChartNoAxesCombined, Coffee, Store } from 'lucide-react';

const features = [
  { icon: Store, text: 'ดูแลหลายสาขาในบัญชีเดียว' },
  { icon: ChartNoAxesCombined, text: 'เทียบยอดขายและติดตามผล' },
  { icon: Coffee, text: 'จัดการเมนูและสมาชิกได้ง่าย' },
];

export function AuthShowcase() {
  return (
    <aside
      data-auth-showcase
      aria-label="เกี่ยวกับ Cafe'nMe"
      className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden rounded-[2rem] bg-[#3B2A20] p-8 text-white shadow-[0_24px_64px_rgba(59,42,32,0.18)] lg:flex xl:p-10"
    >
      <div className="absolute -top-24 -right-24 size-80 rounded-full border border-white/10" aria-hidden="true" />
      <div className="absolute -top-12 -right-12 size-56 rounded-full border border-white/10" aria-hidden="true" />
      <div className="relative z-10 flex items-center gap-3">
        <Image src="/assets/logo-mark.png" alt="" width={48} height={48} className="rounded-xl bg-white/10 p-1" />
        <span className="text-lg font-semibold tracking-tight">Cafe'nMe</span>
      </div>

      <div className="relative z-10 max-w-lg py-10">
        <p className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-wide text-[#F0D2B2]">
          เครื่องมือสำหรับร้านกาแฟของคุณ
        </p>
        <h2 className="text-4xl leading-[1.15] font-semibold tracking-tight xl:text-5xl">
          ดูแลทุกสาขา
          <br />
          ได้ในที่เดียว
        </h2>
        <p className="mt-4 max-w-md text-base leading-7 text-white/70">
          จัดการหน้าร้าน เมนู และความสัมพันธ์กับลูกค้าได้จากพื้นที่ทำงานเดียว
        </p>
        <ul className="mt-8 space-y-4">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm font-medium text-white/90">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#E8BD91]">
                <Icon aria-hidden="true" size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-4">
        <p className="max-w-[220px] text-xs leading-5 text-white/55">
          ทุกวันของร้านจัดการได้ง่ายขึ้น เมื่อข้อมูลอยู่ครบในที่เดียว
        </p>
        <div className="relative size-36 shrink-0 overflow-hidden rounded-3xl border border-white/15 shadow-2xl xl:size-44">
          <Image
            src="/assets/menu/pink-milk.webp"
            alt="นมชมพูเย็นจากเมนูตัวอย่าง"
            fill
            sizes="(min-width: 1280px) 176px, 144px"
            className="object-cover"
          />
        </div>
      </div>
    </aside>
  );
}
