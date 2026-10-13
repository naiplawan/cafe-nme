"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { StaffActionState } from "./actions";
import { createStaffAction, setStaffActiveAction, setStaffPinAction } from "./actions";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : children}</Button>;
}

function Message({ state }: { state: StaffActionState }) {
  return state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null;
}

export function AddStaffForm() {
  const [state, action] = useActionState(createStaffAction, { message: null });
  return <Card><CardHeader><CardTitle>เพิ่มพนักงาน</CardTitle></CardHeader><CardContent>
    <form action={action} className="grid gap-4 sm:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="staff-name">ชื่อ</Label><Input id="staff-name" name="name" required maxLength={80} /></div>
      <div className="space-y-2"><Label htmlFor="staff-role">บทบาท</Label><StaffRoleSelect /><p className="text-xs text-muted-foreground">บาริสต้าใช้หน้าขาย ส่วนผู้จัดการและเจ้าของจัดการพนักงานและอุปกรณ์ได้</p></div>
      <div className="space-y-2"><Label htmlFor="staff-pin">PIN (4–6 หลัก)</Label><Input id="staff-pin" name="pin" inputMode="numeric" pattern="[0-9]{4,6}" required /></div>
      <div className="flex items-end"><Submit>เพิ่มพนักงาน</Submit></div>
      <div className="sm:col-span-4"><Message state={state} /></div>
    </form>
  </CardContent></Card>;
}

const roles: Record<string, string> = { owner: "เจ้าของร้าน", manager: "ผู้จัดการ", barista: "บาริสต้า" };
function StaffRoleSelect() {
  const [role, setRole] = useState("barista");
  return <>
    <input type="hidden" name="role" value={role} />
    <Select value={role} onValueChange={(value) => { if (value) setRole(value); }}>
      <SelectTrigger id="staff-role"><span>{roles[role]}</span></SelectTrigger>
      <SelectContent><SelectItem value="barista">บาริสต้า</SelectItem><SelectItem value="manager">ผู้จัดการ</SelectItem><SelectItem value="owner">เจ้าของร้าน</SelectItem></SelectContent>
    </Select>
  </>;
}

export function StaffRow({ row, currentStaffId }: { row: { id: string; name: string; role: string; hasPin: boolean; isActive: boolean }; currentStaffId: string }) {
  const pinAction = setStaffPinAction.bind(null, row.id);
  const [pinState, savePin] = useActionState(pinAction, { message: null });
  const activeAction = setStaffActiveAction.bind(null, row.id, !row.isActive);
  const [activeState, toggleActive] = useActionState(activeAction, { message: null });
  return <TableRow>
    <TableCell className="px-4 py-3 font-medium">{row.name}</TableCell>
    <TableCell className="px-4 py-3"><Badge variant="outline">{roles[row.role] ?? row.role}</Badge></TableCell>
    <TableCell className="px-4 py-3"><Badge variant={row.hasPin ? "secondary" : "outline"}>{row.hasPin ? "ตั้งแล้ว" : "ยังไม่ได้ตั้ง"}</Badge></TableCell>
    <TableCell className="px-4 py-3"><Badge variant={row.isActive ? "secondary" : "outline"}>{row.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</Badge></TableCell>
    <TableCell className="px-4 py-3"><div className="flex flex-wrap items-center gap-2">
      <form action={savePin} className="flex min-w-64 gap-2"><Input name="pin" aria-label={`PIN ของ ${row.name}`} placeholder="PIN ใหม่" inputMode="numeric" pattern="[0-9]{4,6}" required className="h-9 w-28" /><Submit>{row.hasPin ? "เปลี่ยน PIN" : "ตั้ง PIN"}</Submit></form>
      {row.role !== "owner" && row.id !== currentStaffId && <ConfirmSubmit action={toggleActive} shouldConfirm={(_, submitter) => row.isActive && submitter?.value !== "false"} message={`ปิดใช้งานบัญชีของ ${row.name} หรือไม่?`} confirmLabel="ปิดใช้งาน" destructive><Submit>{row.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</Submit></ConfirmSubmit>}
      <Message state={pinState} /><Message state={activeState} />
    </div></TableCell>
  </TableRow>;
}
