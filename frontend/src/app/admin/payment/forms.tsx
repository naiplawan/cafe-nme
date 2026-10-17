"use client";

import { Eye, QrCode } from "lucide-react";
import Image from "next/image";
import { useActionState, useId, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearPromptPayAction, type PromptPayActionState, previewPromptPayAction, savePromptPayAction } from "./actions";

const initialState: PromptPayActionState = { message: null, success: false };

type PreviewRequestGuard = {
  begin: () => number;
  invalidate: () => number;
  isCurrent: (generation: number) => boolean;
};

export function createPreviewRequestGuard(): PreviewRequestGuard {
  let current = 0;
  const advance = () => {
    current += 1;
    return current;
  };
  return { begin: advance, invalidate: advance, isCurrent: (token) => token === current };
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="min-h-11" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก PromptPay ID"}</Button>;
}

function ActionMessage({ state }: { state: PromptPayActionState }) {
  return state.message && !state.fieldError ? <p className={`text-sm ${state.success ? "text-emerald-700" : "text-destructive"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

function ClearButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>
    {pending ? "กำลังปิด…" : "ปิดพร้อมเพย์"}
  </Button>;
}

export function PromptPaySettingsForm({ configured, maskedId }: { configured: boolean; maskedId: string | null }) {
  const [saveState, saveAction, savePending] = useActionState(savePromptPayAction, initialState);
  const [clearState, clearAction, clearPending] = useActionState(clearPromptPayAction, initialState);
  const [promptpayId, setPromptpayId] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [previewPending, startPreview] = useTransition();
  const previewGuardRef = useRef<PreviewRequestGuard | null>(null);
  if (!previewGuardRef.current) previewGuardRef.current = createPreviewRequestGuard();
  const previewGuard = previewGuardRef.current;
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const label = configured ? "หมายเลขพร้อมเพย์ใหม่" : "หมายเลขพร้อมเพย์";

  function invalidatePreview() {
    previewGuard.invalidate();
    setPreview({ status: "idle" });
  }

  function previewSavedId() {
    const requestGeneration = previewGuard.begin();
    setPreview({ status: "pending" });
    startPreview(async () => {
      try {
        const result = await previewPromptPayAction();
        if (!previewGuard.isCurrent(requestGeneration)) return;
        if (result.ok) setPreview({ status: "success", svg: result.svg });
        else setPreview({ status: "error", message: result.message });
      } catch {
        if (previewGuard.isCurrent(requestGeneration)) setPreview({ status: "error", message: "สร้าง QR พร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่" });
      }
    });
  }

  const clearActionWithInvalidation = () => {
    invalidatePreview();
    clearAction();
  };

  return <Card>
    <CardHeader className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>QR พร้อมเพย์</CardTitle>
        <Badge variant={configured ? "secondary" : "outline"}>{configured ? "เปิดใช้งาน" : "ยังไม่ได้ตั้งค่า"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">กำหนดบัญชีที่ร้านใช้รับเงินจาก QR พร้อมเพย์ในหน้า POS</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-6">
        <p className="font-medium">ตั้งค่าพร้อมเพย์ 3 ขั้นตอน</p>
        <p className="mt-1 text-muted-foreground">1. ลงทะเบียนหรือผูกหมายเลขรับเงินกับธนาคารก่อน ใช้เบอร์มือถือหรือเลขประจำตัว 13 หลักของบัญชีร้าน</p>
        <p className="mt-1 text-muted-foreground">2. กรอกหมายเลขนี้แล้วกดบันทึก ระบบจะใช้ ID ที่บันทึกไว้สร้าง QR ในหน้า POS</p>
        <p className="mt-1 text-muted-foreground">3. เปิดดู QR ทดสอบด้านล่าง แล้วใช้แอปธนาคารตรวจชื่อผู้รับก่อนเริ่มรับเงินจริง</p>
      </div>

      {configured && maskedId ? <p className="text-sm">PromptPay ID ปัจจุบัน <span className="font-medium tabular-nums">{maskedId}</span></p> : null}

      <form action={saveAction} onSubmit={invalidatePreview} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={inputId}>{label}</Label>
          <Input
            id={inputId}
            name="promptpayId"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            placeholder="เช่น 08xxxxxxxx"
            className="min-h-11"
            value={promptpayId}
            onChange={(event) => setPromptpayId(event.target.value)}
            aria-invalid={Boolean(saveState.fieldError)}
            aria-describedby={saveState.fieldError ? `${errorId} ${descriptionId}` : descriptionId}
            required
          />
          <p id={descriptionId} className="text-xs text-muted-foreground">กรอกเบอร์มือถือ 10 หลักหรือเลขประจำตัว 13 หลัก ระบบจะแสดงเฉพาะเลขท้ายหลังบันทึก</p>
          {saveState.fieldError ? <p id={errorId} className="text-sm text-destructive" role="alert">{saveState.fieldError}</p> : null}
        </div>
        <SaveButton />
        <ActionMessage state={saveState} />
      </form>

      {configured ? <>
        <section aria-labelledby={`${inputId}-preview-title`} className="space-y-3 border-t pt-4">
          <div>
            <h3 id={`${inputId}-preview-title`} className="flex items-center gap-2 text-sm font-semibold"><QrCode aria-hidden="true" className="size-4" />ตรวจชื่อผู้รับจาก QR</h3>
            <p className="mt-1 text-sm text-muted-foreground">สร้าง QR รับเงินตัวอย่าง 1 บาทจากหมายเลขที่บันทึกไว้ ใช้ตรวจชื่อผู้รับเท่านั้น ไม่ต้องโอนเงินจริง</p>
            <p className="mt-1 text-xs text-muted-foreground">หน้านี้ไม่ได้ยืนยันการเชื่อมต่อกับธนาคาร</p>
          </div>
          <Button type="button" variant="outline" className="min-h-11" onClick={previewSavedId} disabled={previewPending || savePending || clearPending}>
            <Eye aria-hidden="true" />
            {previewPending ? "กำลังสร้าง QR…" : "ดู QR ตรวจชื่อผู้รับ"}
          </Button>
          {preview.status === "error" ? <p className="text-sm text-destructive" role="alert">{preview.message}</p> : null}
          {preview.status === "success" ? <div className="space-y-2 rounded-xl border bg-white p-4 text-center">
            <Image src={`data:image/svg+xml,${encodeURIComponent(preview.svg)}`} alt="QR พร้อมเพย์ตัวอย่าง 1 บาท" width={280} height={280} unoptimized className="mx-auto size-[min(280px,80vw)]" />
            <p className="text-sm font-medium">ตรวจชื่อผู้รับในแอปธนาคารเท่านั้น ไม่ต้องโอนเงินจริง</p>
          </div> : null}
        </section>

        <div className="border-t pt-4">
          <ConfirmSubmit action={clearActionWithInvalidation} title="ปิดการรับชำระด้วยพร้อมเพย์?" message="เมื่อปิดแล้ว หน้า POS จะไม่แสดงตัวเลือกพร้อมเพย์ จนกว่าจะบันทึกหมายเลขใหม่" confirmLabel="ปิดพร้อมเพย์" destructive>
            <ClearButton />
          </ConfirmSubmit>
          <ActionMessage state={clearState} />
        </div>
      </> : null}
    </CardContent>
  </Card>;
}

type PreviewState =
  | { status: "idle" | "pending" }
  | { status: "success"; svg: string }
  | { status: "error"; message: string };
