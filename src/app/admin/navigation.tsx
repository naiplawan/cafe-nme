"use client";

import Link from "next/link";
import {
  BarChart3,
  LayoutDashboard,
  MessageCircle,
  Package,
  Palette,
  SlidersHorizontal,
  Tablet,
  UserRound,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { Flip, gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { useEffect, useRef } from "react";
import { cn } from "cn";

const sections = [
  { label: "ร้านของคุณ", links: [{ href: "/admin", label: "ภาพรวม", icon: LayoutDashboard }] },
  { label: "ยอดขายและลูกค้า", links: [
    { href: "/admin/reports", label: "รายงาน", icon: BarChart3 },
    { href: "/admin/members", label: "สมาชิก", icon: Users },
  ] },
  { label: "สินค้าและทีม", links: [
    { href: "/admin/menu", label: "เมนู", icon: Package },
    { href: "/admin/modifiers", label: "ตัวเลือกเสริม", icon: SlidersHorizontal },
    { href: "/admin/staff", label: "พนักงาน", icon: UserRound },
    { href: "/admin/devices", label: "เครื่อง POS", icon: Tablet },
  ] },
  { label: "ตั้งค่าร้าน", links: [
    { href: "/admin/line", label: "เชื่อมต่อ LINE", icon: MessageCircle },
    { href: "/admin/brand", label: "แบรนด์", icon: Palette },
  ] },
];

export function AdminNavigation({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const orientation = horizontal ? "horizontal" : "vertical";
  const links = sections.flatMap((section) => section.links);
  useEffect(() => {
    if (!horizontal) return;
    const activeLink = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activeLink?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  }, [horizontal, pathname]);

  const selectLink = () => {
    if (prefersReducedMotion() || !navRef.current) return;
    const indicator = navRef.current.querySelector(`[data-admin-nav-indicator="${orientation}"]`);
    if (indicator) flipState.current = Flip.getState(indicator);
  };

  useGSAP(() => {
    if (!navRef.current || prefersReducedMotion()) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      if (!horizontal) {
        const page = document.querySelector<HTMLElement>("[data-admin-page]");
        if (page) gsap.fromTo(page, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
      }
      const state = flipState.current;
      if (state) {
        Flip.from(state, { duration: MOTION.base, ease: MOTION.ease, absolute: true });
        flipState.current = null;
      }
      const line = navRef.current?.querySelector<HTMLElement>(`[data-admin-nav-indicator="${orientation}"] [data-nav-line]`);
      if (line) gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: navRef, dependencies: [pathname], revertOnUpdate: true });

  return (
    <div className={cn(horizontal && "relative before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-20 before:w-3 before:bg-gradient-to-r before:from-card before:to-transparent after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-20 after:w-3 after:bg-gradient-to-l after:from-card after:to-transparent")}>
      <nav
        ref={navRef}
        aria-label="เมนูผู้ดูแล"
        className={cn("flex gap-1", horizontal ? "flex-row overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-col gap-5")}
      >
        {horizontal ? links.map((link) => <NavigationLink key={link.href} {...link} pathname={pathname} orientation={orientation} onSelect={selectLink} />) : sections.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">{section.label}</p>
            {section.links.map((link) => <NavigationLink key={link.href} {...link} pathname={pathname} orientation={orientation} onSelect={selectLink} />)}
          </div>
        ))}
      </nav>
    </div>
  );

}

function NavigationLink({
  href,
  label,
  icon: Icon,
  pathname,
  orientation,
  onSelect,
}: {
  href: string;
  label: string;
  icon: (typeof sections)[number]["links"][number]["icon"];
  pathname: string;
  orientation: string;
  onSelect: () => void;
}) {
  const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-10 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {active && <span data-admin-nav-indicator={orientation} data-flip-id={`admin-active-${orientation}`} aria-hidden="true" className="absolute inset-0 rounded-xl bg-sidebar-primary"><span data-nav-line className="absolute inset-x-3 bottom-0.5 h-[2px] origin-left rounded-full bg-current" /></span>}
      <span className="relative z-10 flex items-center gap-3"><Icon aria-hidden="true" className="size-4" />{label}</span>
    </Link>
  );
}
