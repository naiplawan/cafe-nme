import { requireStaff } from '@/lib/auth';
import { getLoyaltyGroups } from '@/server/loyalty-groups';
import { AdminAccessDenied } from '../_components/access-denied';
import { AdminPageHeader } from '../_components/page-header';
import { GroupForm } from './form';
export default async function Page() {
  const session = await requireStaff();
  if (session.staff.role !== 'owner') {
    return <AdminAccessDenied message="ต้องใช้บัญชีเจ้าของร้านเพื่อจัดการแสตมป์ร่วมสาขา" />;
  }
  const settings = await getLoyaltyGroups(session.shopId, session.staff.id);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="สมาชิก"
        title="แสตมป์ร่วมสาขา"
        description="เลือกสาขาของคุณที่ใช้ยอดแสตมป์และรางวัลร่วมกัน"
      />
      <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <p>
          ใช้ร่วมกันเฉพาะสมาชิกที่ยืนยันตัวตนด้วย LINE บัญชีเดียวกันในสาขาที่เลือก
          สมาชิกที่มีเพียงเบอร์โทรยังสะสมแยกตามสาขา
        </p>
        <p>หลังสร้างกลุ่มไม่สามารถเปลี่ยนสาขาหรือย้ายกลุ่มได้ เพื่อรักษายอดแสตมป์และภาระรางวัลที่มีอยู่</p>
        <p>สาขาที่ออกแต่ละรางวัลเป็นผู้ออกรางวัลและรับผิดชอบรางวัลนั้น แม้ลูกค้าใช้ที่สาขาอื่น</p>
      </div>
      {settings.group ? (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">{settings.group.name}</h2>
          <h3 className="font-medium">รางวัลพร้อมใช้แยกตามผู้ออกรางวัล</h3>
          <ul className="divide-y">
            {settings.group.shops.map((shop) => (
              <li key={shop.id} className="flex justify-between gap-4 py-3">
                <span>{shop.name}</span>
                <span>{shop.outstandingRewards} รางวัล</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <GroupForm shops={settings.shops} currentShopId={session.shopId} />
      )}
    </div>
  );
}
