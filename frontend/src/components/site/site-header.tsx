import Link from "next/link";
import { PillLink } from "./pill";
import { WordmarkLink } from "./wordmark";

const nav = [["/#features", "ฟีเจอร์"], ["/#how", "วิธีเริ่ม"], ["/#faq", "คำถาม"], ["/contact", "ติดต่อเรา"]] as const;
const link = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-[15px] font-medium text-espresso hover:text-caramel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-[1140px] items-center gap-3 border-b border-dashed border-line px-4 py-3 md:gap-5">
      <WordmarkLink preload />
      <nav aria-label="เมนูหลัก" className="ml-auto hidden gap-3 md:flex">
        {nav.map(([href, label]) => <Link key={href} href={href} className={link}>{label}</Link>)}
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <Link href="/login" className={`${link} border-[1.5px] border-espresso px-5 font-bold hover:bg-butter hover:text-espresso max-sm:hidden`}>เข้าสู่ระบบ</Link>
        <PillLink href="/signup">สมัครใช้งาน</PillLink>
      </div>
    </header>
  );
}
