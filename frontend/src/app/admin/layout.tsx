import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/server/auth-actions";
import { requireStaff } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { thaiInitial } from "@/lib/thai";
import { AdminNavigation } from "./navigation";

// Every admin page reads the session cookie, so it renders per request.
export const instant = false;

const roleLabels = {
  owner: "เจ้าของร้าน",
  manager: "ผู้จัดการ",
  barista: "บาริสต้า",
} as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { staff, shop } = await requireStaff();

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,oklch(0.97_0.018_78),oklch(0.94_0.022_68))] md:grid md:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-sidebar-border/80 bg-sidebar/95 px-5 py-6 backdrop-blur md:flex md:flex-col">
        <Link href="/admin" className="mb-8 flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-sidebar-accent/60">
          <Image src="/assets/logo-mark.png" alt="Cafe'nMe" width={44} height={44} className="rounded-xl" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-sidebar-foreground">{shop.name}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">จัดการร้าน</span>
          </span>
        </Link>
        <AdminNavigation role={staff.role} />
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-background/60 p-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{thaiInitial(staff.name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">{staff.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{roleLabels[staff.role]}</span>
            </span>
          </div>
          <form action={signOut} className="mt-3 border-t border-sidebar-border pt-2">
            <Button type="submit" variant="ghost" className="h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground">
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 px-4 py-3 shadow-sm backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="flex min-w-0 items-center gap-2">
              <Image src="/assets/logo-mark.png" alt="Cafe'nMe" width={34} height={34} />
              <span className="truncate font-semibold">{shop.name}</span>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">ออกจากระบบ</Button>
            </form>
          </div>
          <div className="mt-3">
            <AdminNavigation horizontal role={staff.role} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {staff.name} · {roleLabels[staff.role]}
          </p>
        </header>
        <main data-admin-page className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 md:px-8 md:py-9 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
