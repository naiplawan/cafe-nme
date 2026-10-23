import { requireStaff } from "@/lib/auth";
import { getPromptPaySettings } from "@/server/payment-settings";
import { AdminAccessDenied } from "../_components/access-denied";
import { AdminPageHeader } from "../_components/page-header";
import { PromptPaySettingsForm } from "./forms";

export const instant = false;

function maskPromptPayId(value: string | null) {
  if (!value) return null;
  return `${"•".repeat(value.length - 4)}${value.slice(-4)}`;
}

export default async function PaymentSettingsPage() {
  const session = await requireStaff();
  if (session.staff.role !== "owner") return <AdminAccessDenied message="เฉพาะเจ้าของร้านเท่านั้นที่ตั้งค่าพร้อมเพย์ได้" />;

  const { promptpayId } = await getPromptPaySettings(session.shopId, session.staff.id);
  return <section className="space-y-6">
    <AdminPageHeader section="ตั้งค่าร้าน" title="การชำระเงิน" description="ตั้งค่าบัญชีรับเงินพร้อมเพย์ที่ใช้สร้าง QR ในหน้า POS" />
    <div className="max-w-3xl">
      <PromptPaySettingsForm shopId={session.shopId} configured={Boolean(promptpayId)} maskedId={maskPromptPayId(promptpayId)} />
    </div>
  </section>;
}
