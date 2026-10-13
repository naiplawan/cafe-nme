import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getBrand } from "@/server/brand";
import { getLineConfig } from "@/server/line";
import { BrandForms } from "./forms";
import { AdminPageHeader } from "../_components/page-header";

export default async function BrandAdminPage() {
  const session = await requireStaff();
  if (session.staff.role === "barista") return <p>ไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
  const [brand, shopRows, lineConfig] = await Promise.all([
    getBrand(session.shopId),
    db.select({ name: shops.name, slug: shops.slug }).from(shops).where(eq(shops.id, session.shopId)).limit(1),
    getLineConfig(session.shopId),
  ]);
  const shop = shopRows[0];
  return <section className="space-y-6">
    <AdminPageHeader section="ตั้งค่าร้าน" title="แบรนด์ร้าน" description="โลโก้และสีของร้านจะแสดงในบัตรสมาชิก LINE ใบเสร็จ และหน้า POS" />
    {shop && <BrandForms shopId={session.shopId} shopName={shop.name} accent={brand.accent} logoUrl={brand.logoUrl} lineConfigured={Boolean(lineConfig.accessToken)} />}
  </section>;
}
