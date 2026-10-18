import Image from "next/image";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { findStaffShops } from "@/server/staff-session";
import { selectShop } from "@/server/auth-actions";

const roleLabels = { owner: "เจ้าของร้าน", manager: "ผู้จัดการ", barista: "บาริสต้า" } as const;

export default async function SelectShopPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const shops = await findStaffShops(user.id);
  if (shops.length === 0) redirect("/onboarding");
  if (shops.length === 1) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-[0_18px_44px_rgba(59,42,32,0.10)] ring-1 ring-foreground/10 sm:p-8">
        <div className="mb-6 text-center">
          <Image src="/assets/logo-mark.png" alt="Cafe'nMe" width={56} height={56} className="mx-auto mb-4 size-14" />
          <h1 className="text-2xl font-semibold">เลือกสาขาที่ต้องการจัดการ</h1>
          <p className="mt-2 text-sm text-muted-foreground">ข้อมูลของแต่ละสาขาจะแยกจากกัน</p>
        </div>
        <div className="space-y-3">
          {shops.map(({ shop, shopId, staff }) => (
            <form key={shopId} action={selectShop}>
              <input type="hidden" name="shopId" value={shopId} />
              <Button type="submit" variant="outline" className="h-auto w-full justify-between rounded-xl px-4 py-4 text-left">
                <span>
                  <span className="block font-semibold">{shop.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{roleLabels[staff.role]}</span>
                </span>
                <span aria-hidden="true" className="text-muted-foreground">เลือก →</span>
              </Button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
