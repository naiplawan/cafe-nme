"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { StaffActionState } from "./actions";
import { createStaffAction, setStaffActiveAction, setStaffPinAction } from "./actions";

function Submit({ children, variant = "default" }: { children: string; variant?: "default" | "outline" | "destructive" }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending}>{pending ? "กำลังบันทึก…" : children}</Button>;
}

export function StaffActionMessage({ state }: { state: StaffActionState }) {
  if (!state.message) {
    return null;
  }
  const success = state.success === true;
  return <p role={success ? "status" : "alert"} className={`text-sm ${success ? "text-emerald-700" : "text-destructive"}`}>{state.message}</p>;
}

export function AddStaffForm({ currentStaffRole }: { currentStaffRole: string }) {
  const [state, action] = useActionState(createStaffAction, { message: null });
  const id = useId();
  return <Card><CardHeader><CardTitle>เพิ่มพนักงาน</CardTitle></CardHeader><CardContent>
    <form action={action} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor={`${id}-name`}>ชื่อ</Label><Input id={`${id}-name`} name="name" required maxLength={80} /></div>
      <div className="space-y-2"><Label htmlFor={`${id}-role`}>บทบาท</Label><StaffRoleSelect id={`${id}-role`} currentStaffRole={currentStaffRole} /><p className="text-xs text-muted-foreground">บาริสต้าใช้หน้าขาย ส่วนผู้จัดการและเจ้าของจัดการพนักงานและอุปกรณ์ได้</p></div>
      <div className="space-y-2"><Label htmlFor={`${id}-pin`}>PIN (4–6 หลัก)</Label><Input id={`${id}-pin`} name="pin" inputMode="numeric" pattern="[0-9]{4,6}" required /></div>
      <div className="flex items-end"><Submit>เพิ่มพนักงาน</Submit></div>
      <div className="sm:col-span-2 xl:col-span-4"><StaffActionMessage state={state} /></div>
    </form>
  </CardContent></Card>;
}

const roles: Record<string, string> = { owner: "เจ้าของร้าน", manager: "ผู้จัดการ", barista: "บาริสต้า" };
function StaffRoleSelect({ id, currentStaffRole }: { id: string; currentStaffRole: string }) {
  const [role, setRole] = useState("barista");
  return <>
    <input type="hidden" name="role" value={role} />
    <Select value={role} onValueChange={(value) => { if (value) setRole(value); }}>
      <SelectTrigger id={id}><span>{roles[role]}</span></SelectTrigger>
      <SelectContent><SelectItem value="barista">บาริสต้า</SelectItem><SelectItem value="manager">ผู้จัดการ</SelectItem>{currentStaffRole === "owner" && <SelectItem value="owner">เจ้าของร้าน</SelectItem>}</SelectContent>
    </Select>
  </>;
}

export function StaffRow({ row, currentStaffId, currentStaffRole }: { row: { id: string; name: string; role: string; hasPin: boolean; isActive: boolean }; currentStaffId: string; currentStaffRole: string }) {
  const pinAction = setStaffPinAction.bind(null, row.id);
  const [pinState, savePin] = useActionState(pinAction, { message: null });
  const [pin, setPin] = useState("");
  const activeAction = setStaffActiveAction.bind(null, row.id, !row.isActive);
  const [activeState, toggleActive] = useActionState(activeAction, { message: null });
  useEffect(() => {
    if (pinState.success) {
      setPin("");
    }
  }, [pinState]);
  let deactivationMessage: string | null = null;
  if (row.role === "owner") {
    deactivationMessage = "บัญชีเจ้าของร้านไม่สามารถปิดใช้งานได้";
  } else if (row.id === currentStaffId) {
    deactivationMessage = "บัญชีที่กำลังใช้งานอยู่ไม่สามารถปิดใช้งานได้";
  }
  return <Card>
    <CardHeader className="gap-3 pb-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-base">{row.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{roles[row.role] ?? row.role}</p>
        </div>
        <Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</Badge>
      </div>
      <div>
        <Badge variant={row.hasPin ? "secondary" : "outline"}>PIN {row.hasPin ? "ตั้งแล้ว" : "ยังไม่ได้ตั้ง"}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {(currentStaffRole === "owner" || row.role !== "owner") && <section aria-label={`จัดการ PIN ของ ${row.name}`} className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">PIN สำหรับเข้าใช้งาน POS</p>
        <form action={savePin} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input name="pin" aria-label={`PIN ใหม่ของ ${row.name}`} placeholder="กรอก PIN 4–6 หลัก" inputMode="numeric" pattern="[0-9]{4,6}" required value={pin} onChange={(event) => setPin(event.currentTarget.value)} />
          <Submit>{row.hasPin ? "เปลี่ยน PIN" : "ตั้ง PIN"}</Submit>
        </form>
        <StaffActionMessage state={pinState} />
      </section>}
      {deactivationMessage ? <p className="border-t pt-3 text-xs text-muted-foreground">{deactivationMessage}</p> : <div className="flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">สิทธิ์เข้าใช้งานบัญชี</p>
        <ConfirmSubmit className="shrink-0" action={toggleActive} shouldConfirm={(_, submitter) => row.isActive && submitter?.value !== "false"} message={`ปิดใช้งานบัญชีของ ${row.name} หรือไม่?`} confirmLabel="ปิดใช้งาน" destructive>
          <Submit variant={row.isActive ? "destructive" : "outline"}>{row.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</Submit>
        </ConfirmSubmit>
      </div>}
      <StaffActionMessage state={activeState} />
    </CardContent>
  </Card>;
}
