"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/ui/copy-button";
import type { DeviceActionState } from "./actions";
import { createDeviceAction, regenerateDeviceCodeAction, removeDeviceAction } from "./actions";

const expiryTimeFormat = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : children}</Button>;
}
function ErrorMessage({ state }: { state: DeviceActionState }) {
  return state.message ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null;
}
function PairingCode({ state }: { state: DeviceActionState }) {
  return state.code ? <div className="space-y-1 rounded-lg border bg-muted/30 p-4 text-center">
    {state.qrDataUrl && <div role="img" aria-label="QR code สำหรับเปิดหน้าจับคู่เครื่อง POS" className="mx-auto size-44 rounded bg-white bg-contain bg-center bg-no-repeat p-2" style={{ backgroundImage: `url(${state.qrDataUrl})` }} />}
    <div className="flex flex-wrap items-center justify-center gap-3"><p className="text-4xl font-bold tracking-[0.3em]">{state.code}</p><CopyButton value={state.code} label="คัดลอกรหัส" /></div>
    <p className="text-sm">หมดอายุ {expiryTimeFormat.format(new Date(state.expiresAt ?? ""))}</p>
    {state.pairUrl && <p className="break-all text-sm">สแกน QR หรือเปิด {state.pairUrl} บนแท็บเล็ต แล้วกรอกรหัสนี้</p>}
  </div> : null;
}

export function AddDeviceForm() {
  const [state, action] = useActionState(createDeviceAction, { message: null });
  const nameId = useId();
  return <Card><CardHeader><CardTitle>เพิ่มเครื่อง</CardTitle></CardHeader><CardContent className="space-y-4">
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-2"><Label htmlFor={nameId}>ชื่อเครื่อง</Label><Input id={nameId} name="name" placeholder="เช่น แท็บเล็ตหน้าร้าน" maxLength={80} required /></div>
      <Submit>เพิ่มเครื่อง</Submit><ErrorMessage state={state} />
    </form>
    <PairingCode state={state} />
  </CardContent></Card>;
}

export function DeviceActions({ deviceId }: { deviceId: string }) {
  const [codeState, regenerate] = useActionState(regenerateDeviceCodeAction.bind(null, deviceId), { message: null });
  const [removeState, remove] = useActionState(removeDeviceAction.bind(null, deviceId), { message: null });
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><form action={regenerate}><Submit>ออกโค้ดใหม่</Submit></form><ConfirmSubmit action={remove} destructive confirmLabel="ลบ" message="ลบเครื่อง POS นี้หรือไม่? เครื่องนี้จะต้องจับคู่ใหม่ก่อนใช้งานอีกครั้ง"><Button type="submit" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">ลบเครื่อง</Button></ConfirmSubmit></div>
    <PairingCode state={codeState} /><ErrorMessage state={codeState} /><ErrorMessage state={removeState} />
  </div>;
}
