"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { BrandLogo, BrandStamp } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND_PRESETS, DEFAULT_ACCENT, LOGO_MAX_BYTES, brandVars, contrastRatio, normalizeHex, onAccent } from "@/lib/brand";
import { pushRichMenuAction, removeLogoAction, saveAccentAction, uploadLogoAction, type BrandActionState } from "./actions";

const emptyState: BrandActionState = { message: null, success: false };

function Result({ state }: { state: BrandActionState }) {
  if (!state.message) return null;
  return <p aria-live="polite" className={state.success ? "text-sm text-green-700" : "text-sm text-destructive"}>{state.message}</p>;
}

function resizeLogo(file: File): Promise<Blob> {
  return createImageBitmap(file).then((bitmap) => new Promise((resolve, reject) => {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); reject(new Error("ไม่สามารถเตรียมไฟล์โลโก้ได้")); return; }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("ไม่สามารถเตรียมไฟล์โลโก้ได้")), "image/png");
  }));
}

export function BrandForms({ shopId, shopName, accent: initialAccent, logoUrl, lineConfigured }: {
  shopId: string; shopName: string; accent: string; logoUrl: string | null; lineConfigured: boolean;
}) {
  const [accent, setAccent] = useState(initialAccent);
  const [accentState, accentAction, accentPending] = useActionState(saveAccentAction, emptyState);
  const [logoState, logoAction, logoPending] = useActionState(uploadLogoAction, emptyState);
  const [removeState, removeAction, removePending] = useActionState(removeLogoAction, emptyState);
  const [menuState, menuAction, menuPending] = useActionState(pushRichMenuAction, emptyState);
  const [logoError, setLogoError] = useState<string | null>(null);
  // Changes only once the server has the new logo / colour, so the preview never fetches early.
  const richMenuKey = encodeURIComponent(`${logoUrl ?? "none"}|${initialAccent}`);
  const [resizing, startResize] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const normalizedAccent = normalizeHex(accent) ?? DEFAULT_ACCENT;
  const currentAccent = normalizedAccent;
  const contrastWarning = contrastRatio(currentAccent, onAccent(currentAccent)) < 4.5;

  function submitLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setLogoError("กรุณาเลือกไฟล์โลโก้"); return; }
    setLogoError(null);
    startResize(async () => {
      try {
        let blob = await resizeLogo(file);
        let filename = "logo.png";
        if (blob.size > LOGO_MAX_BYTES) {
          const bitmap = await createImageBitmap(blob);
          blob = await new Promise<Blob>((resolve, reject) => {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d");
            if (!context) { bitmap.close(); reject(new Error("ไม่สามารถเตรียมไฟล์โลโก้ได้")); return; }
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error("ไม่สามารถเตรียมไฟล์โลโก้ได้")), "image/webp", 0.9);
          });
          filename = "logo.webp";
        }
        if (blob.size > LOGO_MAX_BYTES) { setLogoError("ไฟล์โลโก้ใหญ่เกิน 300 KB หลังปรับขนาด"); return; }
        const data = new FormData();
        data.set("logo", blob, filename);
        startResize(() => logoAction(data));
      } catch (error) {
        setLogoError(error instanceof Error ? error.message : "ไม่สามารถเตรียมไฟล์โลโก้ได้");
      }
    });
  }

  return <div className="grid gap-6 lg:grid-cols-2">
    <Card><CardHeader><CardTitle>โลโก้ร้าน</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex min-h-24 items-center gap-4 rounded-lg border bg-muted/30 p-4"><BrandLogo logoUrl={logoUrl} size={96} alt={`โลโก้ ${shopName}`} /><p className="text-sm text-muted-foreground">แสดงบนบัตรสมาชิก ใบเสร็จ และหน้า POS</p></div>
      <form onSubmit={submitLogo} className="space-y-3">
        <div className="space-y-2"><Label htmlFor="brand-logo">ไฟล์โลโก้</Label><Input ref={fileRef} id="brand-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></div>
        <Button type="submit" className="min-h-11" disabled={logoPending || resizing}>{logoPending || resizing ? "กำลังบันทึก…" : "อัปโหลดโลโก้"}</Button>
        <Result state={logoState} />{logoError && <p role="alert" className="text-sm text-destructive">{logoError}</p>}
      </form>
      {logoUrl && <form action={removeAction}><Button type="submit" className="min-h-11" variant="outline" disabled={removePending}>{removePending ? "กำลังลบ…" : "ลบโลโก้"}</Button></form>}
      {removeState.message && <Result state={removeState} />}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>สีประจำร้าน</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-3">{BRAND_PRESETS.map((preset) => <Button key={preset.id} type="button" variant="outline" size="icon-lg" aria-label={preset.name} aria-pressed={normalizeHex(accent) === preset.accent} title={preset.name} onClick={() => setAccent(preset.accent)} className="rounded-full border-2 ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground" style={{ backgroundColor: preset.accent }} />)}</div>
      <form action={accentAction} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="brand-color">เลือกสี</Label><input id="brand-color" type="color" value={currentAccent} onChange={(event) => setAccent(event.currentTarget.value)} className="h-11 w-14 cursor-pointer rounded-md border bg-background p-1" /></div>
          <div className="space-y-2"><Label htmlFor="brand-hex">รหัสสี</Label><Input id="brand-hex" value={accent} onChange={(event) => setAccent(event.currentTarget.value)} className="h-11 w-32 font-mono uppercase" /></div></div>
        {contrastWarning && <p className="text-sm text-amber-700">สีนี้อ่านตัวอักษรยาก แนะนำสีที่เข้มขึ้น</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11" name="accent" value={accent} disabled={accentPending}>{accentPending ? "กำลังบันทึก…" : "บันทึกสี"}</Button><Button type="submit" className="min-h-11" name="accent" value="" variant="outline" disabled={accentPending} onClick={() => setAccent(DEFAULT_ACCENT)}>ใช้สีเริ่มต้น</Button></div>
        <Result state={accentState} />
      </form>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>ตัวอย่างบัตรสมาชิก</CardTitle></CardHeader><CardContent>
      <div style={{ ...brandVars(currentAccent) } as CSSProperties} className="mx-auto max-w-sm space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
        <header className="flex items-center gap-3"><BrandLogo logoUrl={logoUrl} size={44} alt={`โลโก้ ${shopName}`} /><div><p className="font-semibold">{shopName}</p><p className="text-xs text-muted-foreground">บัตรสมาชิก</p></div></header>
        <div className="rounded-xl bg-[var(--brand)] p-4 text-[var(--brand-fg)]"><p className="text-sm font-semibold">ยินดีต้อนรับ · คุณแพรว</p><p className="mt-1 text-xs opacity-80">สะสมแต้มเพื่อรับเครื่องดื่มฟรี</p></div>
        <div className="flex justify-between gap-1">{Array.from({ length: 10 }, (_, index) => <BrandStamp key={index} filled={index < 4} logoUrl={logoUrl} size={25} />)}</div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/5 rounded-full bg-[var(--brand)]" /></div>
      </div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Rich Menu ใน LINE</CardTitle></CardHeader><CardContent className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated preview route is served as a dynamic image */}
      <img src={`/api/brand/${shopId}/rich-menu?v=${richMenuKey}`} alt="ตัวอย่างริชเมนู LINE" className="w-full rounded-lg border" style={{ aspectRatio: "2500 / 1686" }} />
      <form action={menuAction} className="space-y-3"><Button type="submit" className="min-h-11" disabled={menuPending || !lineConfigured}>{menuPending ? "กำลังอัปเดต…" : "อัปเดตริชเมนูใน LINE"}</Button>
        {!lineConfigured && <p className="text-sm text-muted-foreground">ตั้งค่า LINE ก่อน · <Link href="/admin/line" className="underline underline-offset-4">ไปตั้งค่า LINE</Link></p>}
        <Result state={menuState} />
      </form>
    </CardContent></Card>
  </div>;
}
