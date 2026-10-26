"use client";

import Link from "next/link";
import { Check, Eye, MessageCircle, Palette, Trash2, Upload } from "lucide-react";
import { useActionState, useId, useRef, useState, useTransition, type CSSProperties, type SyntheticEvent } from "react";
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
  const accentChanged = normalizeHex(accent) !== normalizeHex(initialAccent);

  const fieldId = useId();

  function submitLogo(event: SyntheticEvent<HTMLFormElement>) {
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

  return <div className="space-y-6">
    <section aria-label="ตั้งค่าแบรนด์ร้าน" className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-secondary-foreground"><Palette aria-hidden="true" size={20} /></div>
          <CardTitle>ตัวตนของร้าน</CardTitle>
          <p className="text-sm text-muted-foreground">ตั้งโลโก้และสีที่ลูกค้าจะเห็นบนบัตรสมาชิก ใบเสร็จ และหน้าขาย</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <section aria-labelledby={`${fieldId}-logo-heading`} className="space-y-4">
            <div>
              <h3 id={`${fieldId}-logo-heading`} className="font-semibold">โลโก้ร้าน</h3>
              <p className="mt-1 text-sm text-muted-foreground">ใช้ภาพจัตุรัสเพื่อให้โลโก้ชัดทั้งบนมือถือและใบเสร็จ</p>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
              <div className="grid size-24 shrink-0 place-items-center rounded-2xl border bg-card shadow-sm"><BrandLogo logoUrl={logoUrl} size={72} alt={`โลโก้ ${shopName}`} /></div>
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{logoUrl ? "กำลังใช้โลโก้ร้าน" : "กำลังใช้โลโก้เริ่มต้น"}</p>
                <p className="text-sm text-muted-foreground">PNG, JPG หรือ WebP · ระบบจะย่อภาพให้พอดี · ไม่เกิน 300 KB</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-2"><Label htmlFor={`${fieldId}-logo`}>เลือกรูปโลโก้</Label><Input ref={fileRef} id={`${fieldId}-logo`} name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></div>
              <div className="flex flex-wrap items-center gap-2">
                <form onSubmit={submitLogo}><Button type="submit" disabled={logoPending || resizing}><Upload aria-hidden="true" />{logoPending || resizing ? "กำลังบันทึก…" : logoUrl ? "เปลี่ยนโลโก้" : "บันทึกโลโก้"}</Button></form>
                {logoUrl && <form action={removeAction}><Button type="submit" variant="outline" disabled={removePending}><Trash2 aria-hidden="true" />{removePending ? "กำลังลบ…" : "ใช้โลโก้เริ่มต้น"}</Button></form>}
              </div>
              <Result state={logoState} />
              <Result state={removeState} />
              {logoError && <p role="alert" className="text-sm text-destructive">{logoError}</p>}
            </div>
          </section>

          <div aria-hidden="true" className="h-px bg-border" />

          <section aria-labelledby={`${fieldId}-color-heading`} className="space-y-4">
            <div>
              <h3 id={`${fieldId}-color-heading`} className="font-semibold">สีประจำร้าน</h3>
              <p className="mt-1 text-sm text-muted-foreground">เลือกสีที่อ่านง่าย สีตัวอักษรจะปรับตามสีที่เลือก</p>
            </div>
            <div className="flex flex-wrap gap-2">{BRAND_PRESETS.map((preset) => {
              const selected = normalizeHex(accent) === preset.accent;
              return <Button key={preset.id} type="button" variant="outline" aria-pressed={selected} onClick={() => setAccent(preset.accent)} className={`justify-start gap-2 px-3 ${selected ? "border-primary ring-2 ring-primary/20" : ""}`}>
                <span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-foreground/20" style={{ backgroundColor: preset.accent }} />
                <span>{preset.name}</span>{selected && <Check aria-hidden="true" className="text-secondary-foreground" />}
              </Button>;
            })}</div>
            <form action={accentAction} className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2"><Label htmlFor={`${fieldId}-color`}>เลือกจากแถบสี</Label><input id={`${fieldId}-color`} type="color" value={currentAccent} onChange={(event) => setAccent(event.currentTarget.value)} className="block h-11 w-16 cursor-pointer rounded-lg border bg-background p-1" /></div>
                <div className="space-y-2"><Label htmlFor={`${fieldId}-hex`}>รหัสสี HEX</Label><Input id={`${fieldId}-hex`} value={accent} onChange={(event) => setAccent(event.currentTarget.value)} className="h-11 w-36 font-mono uppercase" autoComplete="off" /></div>
                <span aria-hidden="true" className="mb-1 size-8 rounded-full border border-foreground/20" style={{ backgroundColor: currentAccent }} />
              </div>
              {contrastWarning && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">สีนี้อาจทำให้อ่านตัวอักษรยาก ลองเลือกสีที่เข้มขึ้น</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="accent" value={accent} disabled={accentPending || !accentChanged}>{accentPending ? "กำลังบันทึก…" : "บันทึกสี"}</Button>
                <Button type="submit" name="accent" value="" variant="outline" disabled={accentPending || normalizeHex(accent) === DEFAULT_ACCENT} onClick={() => setAccent(DEFAULT_ACCENT)}>ใช้สีเริ่มต้น</Button>
              </div>
              <Result state={accentState} />
            </form>
          </section>
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-24">
        <CardHeader className="border-b pb-4">
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-secondary-foreground"><Eye aria-hidden="true" size={20} /></div>
          <CardTitle>ตัวอย่างที่ลูกค้าจะเห็น</CardTitle>
          <p className="text-sm text-muted-foreground">ตัวอย่างบัตรสมาชิกอัปเดตทันทีเมื่อเปลี่ยนสี</p>
        </CardHeader>
        <CardContent className="pt-5">
          <div style={{ ...brandVars(currentAccent) } as CSSProperties} className="mx-auto max-w-sm space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
            <header className="flex min-w-0 items-center gap-3"><BrandLogo logoUrl={logoUrl} size={44} alt={`โลโก้ ${shopName}`} /><div className="min-w-0"><p className="truncate font-semibold">{shopName}</p><p className="text-xs text-muted-foreground">บัตรสมาชิก</p></div></header>
            <div className="rounded-xl bg-[var(--brand)] p-4 text-[var(--brand-fg)]"><p className="text-sm font-semibold">ยินดีต้อนรับ · คุณแพรว</p><p className="mt-1 text-xs opacity-80">สะสมแต้มเพื่อรับเครื่องดื่มฟรี</p></div>
            <div className="flex justify-between gap-1">{Array.from({ length: 10 }, (_, index) => `stamp-${index}`).map((stampId, index) => <BrandStamp key={stampId} filled={index < 4} logoUrl={logoUrl} size={25} />)}</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/5 rounded-full bg-[var(--brand)]" /></div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">บัตรตัวอย่าง · สีตัวอักษรจะปรับให้อ่านง่ายโดยอัตโนมัติ</p>
        </CardContent>
      </Card>
    </section>

    <section aria-label="ริชเมนู LINE">
      <Card>
        <CardHeader className="border-b pb-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#06C755]/10 text-[#087A39]"><MessageCircle aria-hidden="true" size={19} /></span><CardTitle>ริชเมนูใน LINE</CardTitle></div>
            <p className="text-sm text-muted-foreground">แสดงทางลัดให้สมาชิกเปิดบัตร ดูรางวัล และเช็กข่าวร้าน</p>
          </div>
          <span className={`mt-3 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium sm:mt-0 ${lineConfigured ? "bg-green-50 text-green-800" : "bg-muted text-muted-foreground"}`}>
            <span aria-hidden="true" className={`size-2 rounded-full ${lineConfigured ? "bg-green-600" : "bg-muted-foreground/50"}`} />
            {lineConfigured ? "พร้อมเชื่อมต่อ LINE" : "ยังไม่ได้ตั้งค่า LINE"}
          </span>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)] lg:items-center">
          <div className="overflow-hidden rounded-xl border bg-muted/20 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated preview route is served as a dynamic image */}
            <img src={`/api/brand/${shopId}/rich-menu?v=${richMenuKey}`} alt="ตัวอย่างริชเมนู LINE" width={2500} height={1686} className="h-auto w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><p className="font-semibold">ส่งหน้าตานี้ไปยัง LINE Official Account</p><p className="text-sm text-muted-foreground">กดอัปเดตเมื่อพร้อม ระบบจะเปลี่ยนริชเมนูที่สมาชิกเห็นใน LINE</p></div>
            <form action={menuAction} className="space-y-3">
              <Button type="submit" disabled={menuPending || !lineConfigured}>{menuPending ? "กำลังอัปเดต…" : "อัปเดตริชเมนูใน LINE"}</Button>
              {!lineConfigured && <p className="text-sm text-muted-foreground">เริ่มจากเชื่อมต่อบัญชี LINE ของร้าน</p>}
              {!lineConfigured && <Link href="/admin/line" className="inline-flex min-h-11 items-center font-medium text-secondary-foreground underline underline-offset-4">ตั้งค่า LINE ก่อน</Link>}
              <Result state={menuState} />
            </form>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>;
}
