import Link from "next/link";

// The shop slug comes from the URL, so this renders per request.
export const instant = false;

export default async function PrivacyPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  return <main className="mx-auto max-w-2xl space-y-5 p-6">
    <h1 className="text-2xl font-semibold">ประกาศความเป็นส่วนตัว</h1>
    <p>ร้านเก็บรหัสผู้ใช้ LINE ชื่อที่แสดง เบอร์โทรศัพท์ และประวัติการซื้อกับแสตมป์ของคุณ</p>
    <p>เราใช้ข้อมูลเพื่อให้บริการสมาชิก สะสมแสตมป์ และมอบสิทธิประโยชน์ของร้าน</p>
    <p>เราจะเก็บข้อมูลไว้จนกว่าคุณจะขอลบข้อมูลสมาชิก</p>
    <p>หากมีคำถามเกี่ยวกับข้อมูล โปรดติดต่อร้านโดยตรง คุณสามารถใช้ปุ่ม “ลบข้อมูลของฉัน” ในหน้าบัตรสมาชิกเพื่อลบข้อมูลได้</p>
    <Link href={`/liff/${shopSlug}`} className="underline">กลับไปหน้าสมาชิก</Link>
  </main>;
}
