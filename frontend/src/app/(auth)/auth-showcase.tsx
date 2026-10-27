import { ChartNoAxesCombined, Coffee, Store } from 'lucide-react';
import Image from 'next/image';
import { displayFont } from '@/components/site/display-font';
import { Sticker } from '@/components/site/sticker';
import { Wordmark } from '@/components/site/wordmark';

const features = [
  { icon: Store, text: 'ดูแลหลายสาขาในบัญชีเดียว' },
  { icon: ChartNoAxesCombined, text: 'เทียบยอดขายและติดตามผล' },
  { icon: Coffee, text: 'จัดการเมนูและสมาชิกได้ง่าย' },
];

export function AuthShowcase() {
  return (
    <aside
      data-auth-showcase
      aria-label="เกี่ยวกับ YELO Coffee"
      className={`${displayFont.variable} relative hidden min-h-[620px] flex-col justify-between overflow-hidden rounded-section bg-espresso p-8 text-cream shadow-soft lg:flex xl:p-10`}
    >
      <div className="absolute -top-24 -right-24 size-80 rounded-full border border-cream/10" aria-hidden="true" />
      <div className="absolute -top-12 -right-12 size-56 rounded-full border border-cream/10" aria-hidden="true" />
      <div className="relative z-10 flex items-center gap-3">
        <Image src="/assets/yelo-coffee-mascot.png" alt="" width={48} height={48} className="rounded-xl bg-cream/10 p-1" />
        <Wordmark tone="cream" className="text-[28px]" />
      </div>

      <div className="relative z-10 max-w-lg py-10">
        <div className="mb-5">
          <Sticker>เครื่องมือสำหรับร้านกาแฟของคุณ</Sticker>
        </div>
        <h2 className="font-display-condensed text-5xl leading-[1.2] xl:text-6xl">
          ดูแลทุกสาขา
          <br />
          ได้ในที่เดียว
        </h2>
        <p className="mt-4 max-w-md text-base leading-7 text-butter">
          จัดการหน้าร้าน เมนู และความสัมพันธ์กับลูกค้าได้จากพื้นที่ทำงานเดียว
        </p>
        <ul className="mt-8 space-y-4">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm font-medium text-cream">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream/10 text-amber">
                <Icon aria-hidden="true" size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-4">
        <p className="max-w-[220px] text-xs leading-5 text-butter">
          ทุกวันของร้านจัดการได้ง่ายขึ้น เมื่อข้อมูลอยู่ครบในที่เดียว
        </p>
        <div className="relative size-36 shrink-0 overflow-hidden rounded-card border border-cream/15 shadow-2xl xl:size-44">
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
