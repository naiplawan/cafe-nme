import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, ChartCard, CountUp } from "@/components/charts";
import { businessDate } from "@/lib/business-date";
import { requireStaff } from "@/lib/auth";
import { listMembers } from "@/server/members";
import { memberGrowth, memberOverview } from "@/server/reports";
import { AdminPageHeader } from "../_components/page-header";

const PAGE_SIZE = 25;
type SearchParams = Promise<{ q?: string | string[]; page?: string | string[]; reward?: string | string[] }>;

function maskPhone(phone: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `${digits.slice(0, 2)}x-xxx-${digits.slice(-4)}` : digits;
}

const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const shortThaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear().toString().padStart(4, "0")}-${(shifted.getUTCMonth() + 1).toString().padStart(2, "0")}-${shifted.getUTCDate().toString().padStart(2, "0")}`;
}

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const { shopId } = await requireStaff();
  const params = await searchParams;
  const search = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawReward = Array.isArray(params.reward) ? params.reward[0] : params.reward;
  const availableReward = rawReward === "available";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const today = businessDate(new Date());
  const from = shiftDate(today, -29);
  const [{ rows, total }, overview, growth] = await Promise.all([
    listMembers(shopId, { search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, availableReward }),
    memberOverview(shopId),
    memberGrowth(shopId, from, today),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const memberStats = [
    { label: "สมาชิกทั้งหมด", value: overview.total },
    { label: "เชื่อม LINE", value: overview.lineLinked },
    { label: "ใช้งาน 30 วัน", value: overview.active30d },
    { label: "รางวัลรอใช้", value: overview.rewardsAvailable },
  ];
  const growthChart = growth.map(({ date, totalMembers }) => ({
    label: shortThaiDate.format(new Date(`${date}T12:00:00+07:00`)),
    value: totalMembers,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader section="ลูกค้า" title="สมาชิก" description="สมาชิกและบัตรสะสมแสตมป์ของร้าน" />
      <div className="space-y-2">
        <form className="flex max-w-2xl flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row" action="/admin/members" method="get">
          <Input type="search" name="q" defaultValue={search} placeholder="ค้นหาชื่อหรือเบอร์โทร" aria-label="ค้นหาชื่อหรือเบอร์โทร" className="border-transparent bg-muted/60 shadow-none focus-visible:border-input" />
          {availableReward && <input type="hidden" name="reward" value="available" />}
          <Button type="submit" className="shrink-0 px-5">ค้นหา</Button>
        </form>
        {availableReward && <div className="flex items-center gap-2 text-sm"><Badge variant="secondary">สมาชิกที่มีรางวัลพร้อมใช้</Badge><Link href="/admin/members" className={buttonVariants({ variant: "link", className: "h-auto p-0" })}>ล้างตัวกรอง</Link></div>}
      </div>
      <section aria-label="ภาพรวมสมาชิก" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {memberStats.map((stat, index) => {
            const isRewardsCard = index === 3;
            const card = <Card key={stat.label} className={isRewardsCard ? "h-full border-primary/25 bg-primary/[0.035] py-0 transition-colors group-hover:bg-primary/[0.07]" : undefined}><CardContent className="p-4">
              <p className={`text-sm font-medium ${isRewardsCard ? "text-primary" : "text-muted-foreground"}`}>{stat.label}</p>
              <CountUp value={stat.value} className={`mt-2 block text-2xl font-semibold tracking-tight ${isRewardsCard ? "text-primary" : ""}`} />
              {isRewardsCard && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">ดูสมาชิกที่มีรางวัล <ArrowRight aria-hidden="true" size={14} /></span>}
            </CardContent></Card>;
            return isRewardsCard
              ? <Link key={stat.label} href="/admin/members?reward=available" aria-label="ดูสมาชิกที่มีรางวัลพร้อมใช้" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{card}</Link>
              : <div key={stat.label}>{card}</div>;
          })}
        </div>
        <ChartCard title="สมาชิกสะสม 30 วัน">
          <AreaChart data={growthChart} format="number" ariaLabel="จำนวนสมาชิกสะสมรายวันใน 30 วันล่าสุด" />
        </ChartCard>
      </section>
      {rows.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <Image src="/assets/empty-members.png" alt="ภาพประกอบที่ยังไม่มีสมาชิก" width={180} height={160} className="mb-4" />
          <h2 className="text-lg font-semibold">ยังไม่พบสมาชิก</h2>
          <p className="mt-1 text-sm text-muted-foreground">สมาชิกที่สมัครผ่าน LINE หรือ POS จะแสดงที่นี่</p>
        </CardContent></Card>
      ) : (
        <>
          <section aria-label="รายชื่อสมาชิก" className="grid gap-3 md:grid-cols-2 lg:hidden">
            {rows.map((member) => <Card key={member.id}><CardContent className="space-y-3 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3"><h2 className="truncate font-semibold">{member.displayName}</h2>{member.lineUserId ? <Badge variant="secondary">เชื่อม LINE</Badge> : <Badge variant="outline">ยังไม่เชื่อม</Badge>}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">เบอร์โทร</dt><dd>{maskPhone(member.phone)}</dd></div>
                <div><dt className="text-muted-foreground">แสตมป์</dt><dd className="font-medium tabular-nums">{member.stampBalance}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">วันที่สมัคร</dt><dd>{dateFormat.format(member.createdAt)}</dd></div>
              </dl>
              <Link href={`/admin/members/${member.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>ดูรายละเอียด</Link>
            </CardContent></Card>)}
          </section>
          <Card className="hidden lg:block"><CardContent className="p-0"><Table>
            <TableHeader><TableRow><TableHead>ชื่อ</TableHead><TableHead>เบอร์โทร</TableHead><TableHead>LINE</TableHead><TableHead>แสตมป์</TableHead><TableHead>วันที่สมัคร</TableHead><TableHead><span className="sr-only">รายละเอียด</span></TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((member) => <TableRow key={member.id}>
              <TableCell className="font-medium">{member.displayName}</TableCell>
              <TableCell>{maskPhone(member.phone)}</TableCell>
              <TableCell>{member.lineUserId ? <Badge variant="secondary">เชื่อมแล้ว</Badge> : <Badge variant="outline">ยังไม่เชื่อม</Badge>}</TableCell>
              <TableCell>{member.stampBalance}</TableCell>
              <TableCell>{dateFormat.format(member.createdAt)}</TableCell>
              <TableCell className="text-right"><Link href={`/admin/members/${member.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>ดูรายละเอียด</Link></TableCell>
            </TableRow>)}</TableBody>
          </Table></CardContent></Card>
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">{total} คน · หน้า {page} จาก {pages}</p>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/admin/members?q=${encodeURIComponent(search)}&reward=${availableReward ? "available" : ""}&page=${page - 1}`} className={buttonVariants({ variant: "outline" })}>ก่อนหน้า</Link>}
              {page < pages && <Link href={`/admin/members?q=${encodeURIComponent(search)}&reward=${availableReward ? "available" : ""}&page=${page + 1}`} className={buttonVariants({ variant: "outline" })}>ถัดไป</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
