import "server-only";
import { requireStaff } from "@/lib/auth";
import { getShopProfile } from "@/server/admin-data";
import { getBrand } from "@/server/brand";
import { getLineConfig } from "@/server/line";
import { BrandForms } from "./forms";
import { AdminPageHeader } from "../_components/page-header";
import { AdminAccessDenied } from "../_components/access-denied";

export default async function BrandAdminPage() {
  const session = await requireStaff();
  if (session.staff.role === "barista") return <AdminAccessDenied message="ต้องใช้บัญชีเจ้าของร้านหรือผู้จัดการเพื่อจัดการแบรนด์ร้าน" />;
  const [brand, shop, lineConfig] = await Promise.all([
    getBrand(session.shopId),
    getShopProfile(session.shopId),
    getLineConfig(session.shopId),
  ]);
  return <section className="space-y-6">
    <AdminPageHeader section="ตั้งค่าร้าน" title="แบรนด์ร้าน" description="โลโก้และสีของร้านจะแสดงในบัตรสมาชิก LINE ใบเสร็จ และหน้า POS" />
    {shop && <BrandForms shopId={session.shopId} shopName={shop.name} accent={brand.accent} logoUrl={brand.logoUrl} lineConfigured={Boolean(lineConfig.accessToken)} />}
  </section>;
}
