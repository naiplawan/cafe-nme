"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo, BrandStamp } from "@/components/brand/brand";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { brandVars } from "@/lib/brand";
import { deleteMyData, getMyCard, register, type MemberCardData, type MemberActionState } from "./actions";
import { MenuView, type LiffMenuCategory } from "./menu-view";
import { readLiffView, type LiffView } from "./view";

const loyaltyDateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const loyaltyLabels: Record<string, string> = { earn: "รับแสตมป์", redeem: "แลกรางวัล", expire: "แสตมป์หมดอายุ", adjust: "ปรับยอด" };

type Card = { registered: false } | ({ registered: true } & MemberCardData);

export function getLiffErrorMessage(error: unknown, liffId: string, isLiffFailure = false): string {
  if (!liffId.trim()) return "ร้านยังไม่ได้ตั้งค่า LINE";
  if (isLiffFailure || (error instanceof Error && /liff|login|auth/i.test(error.message))) return "เปิดหน้านี้จากแอป LINE อีกครั้ง";
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

export function MemberApp({ shopSlug, shopName, liffId, devMock, menu, brand }: { shopSlug: string; shopName: string; liffId: string; devMock: boolean; menu: LiffMenuCategory[]; brand: { accent: string; custom: boolean; logoUrl: string | null } }) {
  const [idToken, setIdToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<LiffView>("card");
  const loadCard = useCallback(async (token: string) => {
    const next = await getMyCard(shopSlug, token);
    setCard(next.registered ? { registered: true, member: next.member, qrToken: next.qrToken } : next);
  }, [shopSlug]);

  useEffect(() => {
    if (!loading) return;
    let active = true;
    void (async () => {
      let isLiffFailure = false;
      try {
        let token: string | null = null;
        if (!devMock && !liffId.trim()) {
          setError(getLiffErrorMessage(null, liffId));
          return;
        }
        if (devMock) {
          token = `dev:U-dev-${shopSlug}`;
          setDisplayName("Dev User");
          setView(readLiffView(window.location.search));
        } else {
          isLiffFailure = true;
          const liff = (await import("@line/liff")).default;
          await liff.init({ liffId });
          if (active) setView(readLiffView(window.location.search));
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }
          token = liff.getIDToken();
          const profile = await liff.getProfile();
          if (active) setDisplayName(profile.displayName);
        }
        if (!token) throw new Error("ไม่พบข้อมูลยืนยันตัวตน LINE");
        isLiffFailure = false;
        if (active) {
          setIdToken(token);
          await loadCard(token);
        }
      } catch (cause) {
        if (active) setError(getLiffErrorMessage(cause, liffId, isLiffFailure));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [devMock, liffId, loadCard, loading, shopSlug]);

  const onRegister = useCallback(async (_state: MemberActionState, formData: FormData): Promise<MemberActionState> => {
    const result = await register(shopSlug, idToken, {
      phone: String(formData.get("phone") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      consent: formData.get("consent") === "on",
    });
    if (result.success) await loadCard(idToken);
    return result;
  }, [idToken, loadCard, shopSlug]);

  if (loading) return <MemberLoadingSkeleton accent={brand.accent} />;
  if (error) return <main style={brandVars(brand.accent) as CSSProperties} className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-sm text-destructive">{error}</p><Button type="button" onClick={() => { setError(""); setLoading(true); }}>ลองอีกครั้ง</Button></main>;
  if (!card) return null;
  if (view === "menu") return <MenuView shopName={shopName} brand={brand} categories={menu} onShowCard={() => setView("card")} />;
  if (!card.registered) return <RegisterForm shopSlug={shopSlug} displayName={displayName} onRegister={onRegister} brand={brand} />;
  return <MemberCardView key={view} shopSlug={shopSlug} shopName={shopName} idToken={idToken} initial={card} loadCard={loadCard} brand={brand} onShowMenu={() => setView("menu")} scrollToStamps={view === "stamps"} alreadyRegisteredNotice={view === "register"} />;
}

function RegisterForm({ shopSlug, displayName, onRegister, brand }: { shopSlug: string; displayName: string; onRegister: (state: MemberActionState, data: FormData) => Promise<MemberActionState>; brand: { accent: string; custom: boolean; logoUrl: string | null } }) {
  const rootRef = useRef<HTMLElement>(null);
  const id = useId();
  const [state, action, pending] = useActionState(onRegister, { message: null, success: false });
  useGSAP(() => {
    if (prefersReducedMotion() || !rootRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const root = rootRef.current;
      if (!root) return;
      const items = root.querySelectorAll("[data-register-item]");
      if (items?.length) gsap.fromTo(items, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease });
      const logoLine = root.querySelector<SVGPathElement>("[data-logo-line]");
      if (logoLine) gsap.fromTo(logoLine, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: rootRef });
  return <main ref={rootRef} style={brandVars(brand.accent) as CSSProperties} className="mx-auto min-h-screen max-w-md p-5">
    <div data-register-item className="mb-6 flex items-center gap-3"><BrandLogo logoUrl={brand.logoUrl} size={44} /><div><h1 className="text-xl font-semibold">สมัครสมาชิก</h1><p className="text-sm text-muted-foreground">สะสมแสตมป์กับร้านของเรา</p><svg aria-hidden="true" className="mt-1 h-2 w-20 text-[#B88A5A]" viewBox="0 0 80 4" fill="none"><path data-logo-line d="M1 2H79" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></div></div>
    <form action={action} className="space-y-5 rounded-2xl border bg-card p-5 shadow-[0_12px_32px_rgba(59,42,32,0.08)]">
      <div data-register-item className="space-y-2"><Label htmlFor={`${id}-displayName`}>ชื่อ</Label><Input id={`${id}-displayName`} name="displayName" defaultValue={displayName} required /></div>
      <div data-register-item className="space-y-2"><Label htmlFor={`${id}-phone`}>เบอร์โทรศัพท์มือถือ</Label><Input id={`${id}-phone`} name="phone" type="tel" inputMode="numeric" pattern="0[0-9]{9}" maxLength={10} required /></div>
      <label data-register-item className="flex items-start gap-3 text-sm"><input name="consent" type="checkbox" required className="mt-1 size-4 accent-primary" /><span>ยินยอมให้ร้านใช้ข้อมูลเพื่อดูแลสมาชิกตาม<a className="ml-1 underline" href={`/liff/${shopSlug}/privacy`}>ประกาศความเป็นส่วนตัว</a></span></label>
      {state.message && <p aria-live="polite" className="text-sm text-destructive">{state.message}</p>}
      <Button data-register-item type="submit" disabled={pending} className={brand.custom ? "w-full bg-[var(--brand)] text-[var(--brand-fg)]" : "w-full"}>{pending ? "กำลังสมัคร…" : "สมัครสมาชิก"}</Button>
    </form>
  </main>;
}

function MemberCardView({ shopSlug, shopName, idToken, initial, loadCard, brand, onShowMenu, scrollToStamps, alreadyRegisteredNotice }: { shopSlug: string; shopName: string; idToken: string; initial: Card & { registered: true }; loadCard: (token: string) => Promise<void>; brand: { accent: string; custom: boolean; logoUrl: string | null }; onShowMenu: () => void; scrollToStamps: boolean; alreadyRegisteredNotice: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const stampsSectionRef = useRef<HTMLDivElement>(null);
  const qrRingRef = useRef<SVGRectElement>(null);
  const qrImageRef = useRef<HTMLImageElement>(null);
  const [qrData, setQrData] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const refreshDeadline = useRef(Date.now() + 30_000);
  const refreshCard = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setRefreshError("");
    try {
      await loadCard(idToken);
      refreshDeadline.current = Date.now() + 30_000;
      setSeconds(30);
    } catch {
      setSeconds(0);
      setRefreshError("อัปเดต QR ไม่สำเร็จ กรุณาลองใหม่ หากยังไม่ได้ให้เปิดจาก LINE อีกครั้ง");
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [idToken, loadCard]);
  const [showSettings, setShowSettings] = useState(false);
  const [dismissedRegisteredNotice, setDismissedRegisteredNotice] = useState(false);
  const showRegisteredNotice = alreadyRegisteredNotice && !dismissedRegisteredNotice;
  const [highlightStamps, setHighlightStamps] = useState(false);
  const deleteAction = async (_state: MemberActionState, formData: FormData): Promise<MemberActionState> => {
    if (formData.get("confirmDelete") !== "on") return { message: "กรุณายืนยันการลบข้อมูล", success: false };
    const result = await deleteMyData(shopSlug, idToken);
    if (result.success) {
      setShowSettings(false);
      await loadCard(idToken);
    }
    return result;
  };
  const [deleteState, deleteFormAction, pending] = useActionState(deleteAction, { message: null, success: false });
  const card = initial;
  const progress = Math.min(1, card.member.stampBalance / card.member.stampGoal);
  useEffect(() => {
    if (!scrollToStamps) return;
    const scrollTimer = window.setTimeout(() => {
      stampsSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      setHighlightStamps(true);
    }, prefersReducedMotion() ? 0 : 500);
    const highlightTimer = window.setTimeout(() => setHighlightStamps(false), prefersReducedMotion() ? 850 : 1500);
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(highlightTimer); };
  }, [scrollToStamps]);
  useGSAP(() => {
    if (prefersReducedMotion() || !rootRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const memberCard = rootRef.current?.querySelector("[data-member-card]");
      if (memberCard) gsap.fromTo(memberCard, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: MOTION.slow, ease: MOTION.ease });
      const stamps = rootRef.current?.querySelectorAll("[data-stamp]");
      if (stamps?.length) gsap.fromTo(stamps, { scale: 0.72, opacity: 0 }, { scale: 1, opacity: 1, duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.pop, delay: 0.1 });
      const progressLine = rootRef.current?.querySelector<HTMLElement>("[data-stamp-progress]");
      if (progressLine) gsap.fromTo(progressLine, { scaleX: 0 }, { scaleX: progress, duration: MOTION.slow, ease: MOTION.ease });
      const glow = rootRef.current?.querySelector("[data-reward-glow]");
      if (glow) gsap.fromTo(glow, { xPercent: -130, opacity: 0 }, { xPercent: 130, opacity: 0.7, duration: 1.2, ease: "power1.inOut" });
    });
    return () => media.revert();
  }, { scope: rootRef });
  useGSAP(() => {
    if (prefersReducedMotion() || !qrRingRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(qrRingRef.current, { drawSVG: "0% 100%" }, { drawSVG: "0% 0%", duration: 30, ease: "none" });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [card.qrToken], revertOnUpdate: true });
  useGSAP(() => {
    if (prefersReducedMotion() || !qrImageRef.current || !qrData) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(qrImageRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [qrData], revertOnUpdate: true });
  useEffect(() => {
    let active = true;
    setQrData("");
    void QRCode.toDataURL(card.qrToken, { width: 280, margin: 1 }).then((url) => { if (active) setQrData(url); })
      .catch(() => { if (active) setRefreshError("สร้าง QR ไม่สำเร็จ กรุณาลองใหม่"); });
    return () => { active = false; };
  }, [card.qrToken]);
  useEffect(() => {
    if (refreshError || refreshing) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((refreshDeadline.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) void refreshCard();
    };
    const ticker = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(ticker); document.removeEventListener("visibilitychange", tick); };
  }, [refreshCard, refreshError, refreshing]);
  return <main ref={rootRef} style={brandVars(brand.accent) as CSSProperties} className="mx-auto min-h-screen max-w-md space-y-4 p-4 pb-8">
    <header className="flex items-center justify-between"><div className="flex items-center gap-3"><BrandLogo logoUrl={brand.logoUrl} size={40} /><div><p className="text-sm text-muted-foreground">สมาชิก</p><h1 className="font-semibold">{shopName}</h1></div></div><div className="flex items-center gap-2"><button type="button" onClick={onShowMenu} className="rounded-full border px-3 py-2 text-sm">เมนู</button><button type="button" onClick={() => setShowSettings(!showSettings)} className="rounded-full border px-3 py-2 text-sm">ตั้งค่า</button></div></header>
    {showRegisteredNotice && <div role="status" className="flex items-center justify-between rounded-xl border border-[#B88A5A] bg-[#FFF8EF] px-4 py-3 text-sm"><p>คุณเป็นสมาชิกอยู่แล้ว</p><button type="button" aria-label="ปิดข้อความ" onClick={() => setDismissedRegisteredNotice(true)} className="rounded p-1"><X aria-hidden="true" size={18} /></button></div>}
    {showSettings ? <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">ข้อมูลสมาชิก</h2><p>{card.member.displayName} · {card.member.phone}</p><form action={deleteFormAction} className="space-y-3"><label className="flex items-start gap-2 text-sm"><input name="confirmDelete" type="checkbox" required className="mt-1" />ยืนยันลบข้อมูลสมาชิกของฉัน</label><Button type="submit" variant="destructive" disabled={pending}>{pending ? "กำลังลบ…" : "ลบข้อมูลของฉัน"}</Button></form>{deleteState.message && <p aria-live="polite" className="text-sm">{deleteState.message}</p>}</section> : <>
      <div ref={stampsSectionRef} className="scroll-mt-4 space-y-4">
      <section data-member-card className="overflow-hidden rounded-3xl bg-card shadow-[0_16px_40px_rgba(59,42,32,0.12)]"><div className="relative min-h-52 p-5"><Image src="/assets/member-card-bg.png" alt="" fill priority sizes="100vw" className="object-cover" /><div aria-hidden="true" className="absolute inset-0" style={{ background: brand.custom ? "linear-gradient(to right, color-mix(in srgb, var(--brand) 85%, black) 0%, color-mix(in srgb, var(--brand) 55%, transparent) 55%, transparent)" : "linear-gradient(to right, rgb(59 42 32 / 0.75), rgb(59 42 32 / 0.45), transparent)" }} /><div className="relative z-10 flex h-full min-h-44 flex-col justify-between" style={{ color: "var(--brand-fg)" }}><div><p className="text-sm opacity-85">ยินดีต้อนรับ</p><h2 className="text-xl font-semibold drop-shadow-sm">{card.member.displayName}</h2></div><p className="text-sm opacity-90">{shopName}</p></div></div>
        <div className="p-5"><p className="mb-3 text-center font-semibold tabular-nums">สะสม {card.member.stampBalance}/{card.member.stampGoal}</p><div className="grid grid-cols-5 gap-3">{Array.from({ length: card.member.stampGoal }, (_, index) => index + 1).map((stampNumber) => <span data-stamp key={stampNumber} className="mx-auto"><BrandStamp filled={stampNumber <= card.member.stampBalance} logoUrl={brand.logoUrl} size={48} alt={stampNumber <= card.member.stampBalance ? "แสตมป์ที่สะสมแล้ว" : "แสตมป์ว่าง"} /></span>)}</div><div aria-hidden="true" className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#E4D6C6]"><div data-stamp-progress className={`h-full w-full origin-left rounded-full ${brand.custom ? "bg-[var(--brand)]" : "bg-[#B88A5A]"}`} style={{ transform: `scaleX(${Math.min(1, card.member.stampBalance / Math.max(1, card.member.stampGoal))})` }} /></div></div>
      </section>
      <section className={`relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 transition-shadow duration-300 ${highlightStamps ? "ring-2 ring-[#B88A5A] shadow-[0_0_24px_rgba(198,156,114,0.32)]" : card.member.stampBalance === 0 && card.member.availableRewards > 0 ? "border-[#B88A5A] shadow-[0_0_24px_rgba(198,156,114,0.24)]" : ""}`}><div data-reward-glow aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0" /><Image src="/assets/reward-free-drink.png" alt="เครื่องดื่มฟรี" width={72} height={72} /><div><h2 className="font-semibold">รางวัลเครื่องดื่มฟรี</h2><p className="text-sm text-muted-foreground">{card.member.availableRewards > 0 ? `ใช้ได้ ${card.member.availableRewards} รางวัล` : `อีก ${Math.max(0, card.member.stampGoal - card.member.stampBalance)} แสตมป์ รับฟรี 1 แก้ว`}</p></div></section>
      </div>
      <section className="space-y-2 rounded-2xl border bg-white p-4 text-center"><p className="font-semibold">แสดง QR นี้ให้พนักงานสแกน</p><div className="relative mx-auto size-[276px] p-[18px]">{qrData && seconds > 0 && !refreshError && !refreshing && <Image ref={qrImageRef} key={card.qrToken} src={qrData} alt="QR สำหรับสะสมแสตมป์" width={240} height={240} unoptimized className="mx-auto" />}<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 276 276"><rect x="3" y="3" width="270" height="270" rx="22" fill="none" stroke="#EADBC8" strokeWidth="3" /><rect ref={qrRingRef} x="3" y="3" width="270" height="270" rx="22" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" /></svg></div>{refreshError ? <div role="alert"><p className="text-sm text-destructive">{refreshError}</p><Button type="button" onClick={() => void refreshCard()}>ลองใหม่</Button></div> : <p role="status" className="text-sm text-muted-foreground">{refreshing ? "กำลังอัปเดต QR…" : `ตรวจสอบ QR อีกครั้งใน ${seconds} วินาที`}</p>}</section>
      {(card.member.nextStampExpiryAt || card.member.nextRewardExpiryAt) && <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        {card.member.nextStampExpiryAt && <p>แสตมป์หมดอายุครั้งถัดไป: {loyaltyDateFormat.format(new Date(card.member.nextStampExpiryAt))}</p>}
        {card.member.nextRewardExpiryAt && <p>รางวัลหมดอายุครั้งถัดไป: {loyaltyDateFormat.format(new Date(card.member.nextRewardExpiryAt))}</p>}
      </section>}
      {card.member.history && card.member.history.length > 0 && <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">ประวัติแสตมป์</h2>
        <ul className="divide-y text-sm">{card.member.history.map((entry) => <li key={entry.id} className="py-2">
          <div className="flex justify-between"><span>{loyaltyLabels[entry.reason] ?? entry.reason}</span><span>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span></div>
          <p className="text-xs text-muted-foreground">{loyaltyDateFormat.format(new Date(entry.createdAt))}</p>
          {entry.expiresAt && <p className="text-xs text-muted-foreground">หมดอายุวันที่ {loyaltyDateFormat.format(new Date(entry.expiresAt))}</p>}
        </li>)}</ul>
      </section>}
      <Link href={`/liff/${shopSlug}/privacy`} className="block text-center text-sm text-muted-foreground underline">ประกาศความเป็นส่วนตัว</Link>
    </>}
  </main>;
}

function MemberLoadingSkeleton({ accent }: { accent: string }) {
  return <main aria-label="กำลังโหลดบัตรสมาชิก" style={brandVars(accent) as CSSProperties} className="mx-auto min-h-screen max-w-md space-y-4 p-4 pb-8">
    <div className="flex items-center gap-3"><div className="size-10 animate-pulse rounded-xl bg-muted" /><div className="space-y-2"><div className="h-3 w-16 animate-pulse rounded bg-muted" /><div className="h-4 w-32 animate-pulse rounded bg-muted" /></div></div>
    <section className="space-y-5 overflow-hidden rounded-3xl border bg-card p-5 shadow-sm"><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="mx-auto h-4 w-36 animate-pulse rounded bg-muted" /><div className="grid grid-cols-5 gap-3">{Array.from({ length: 10 }, (_, index) => index + 1).map((stampNumber) => <div key={stampNumber} className="mx-auto size-12 animate-pulse rounded-full bg-muted" />)}</div></section>
    <div className="h-24 animate-pulse rounded-2xl border bg-card" /><div className="h-80 animate-pulse rounded-2xl border bg-card" />
  </main>;
}
