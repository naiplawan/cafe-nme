"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLineConfigAction, setupRichMenuAction, type LineActionState } from "./actions";

const emptyState: LineActionState = { message: null, success: false };

function Result({ state }: { state: LineActionState }) {
  if (!state.message) return null;
  return <p aria-live="polite" className={state.success ? "text-sm text-green-700" : "text-sm text-destructive"}>{state.message}</p>;
}

export function LineConfigForm({
  config,
  webhookUrl,
  liffUrl,
}: {
  config: { messagingChannelId: string | null; loginChannelId: string | null; liffId: string | null; secretSet: boolean; tokenSet: boolean; richMenuSet: boolean };
  webhookUrl: string;
  liffUrl: string;
}) {
  const [state, action, pending] = useActionState(saveLineConfigAction, emptyState);
  const [menuState, menuAction, menuPending] = useActionState(setupRichMenuAction, emptyState);
  return <div className="space-y-8">
    <Card>
      <form action={action}>
        <CardHeader><CardTitle>ข้อมูลการเชื่อมต่อ</CardTitle><p className="text-sm text-muted-foreground">ข้อมูลลับจะไม่แสดงหลังบันทึก เพื่อความปลอดภัย</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Messaging API Channel ID" name="messagingChannelId" defaultValue={config.messagingChannelId ?? ""} />
            <SecretField label="Channel secret" name="channelSecret" configured={config.secretSet} />
            <SecretField label="Channel access token" name="accessToken" configured={config.tokenSet} />
            <Field label="LINE Login Channel ID" name="loginChannelId" defaultValue={config.loginChannelId ?? ""} />
            <Field label="LIFF ID" name="liffId" defaultValue={config.liffId ?? ""} />
          </div>
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="break-all"><span className="font-medium">Webhook URL</span><br /><span className="text-muted-foreground">{webhookUrl}</span></p>
            <p className="break-all"><span className="font-medium">LIFF URL</span><br /><span className="text-muted-foreground">{liffUrl}</span></p>
          </div>
          <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</Button>
          <Result state={state} />
        </CardContent>
      </form>
    </Card>
    <Card>
      <CardHeader><CardTitle>Rich Menu</CardTitle><p className="text-sm text-muted-foreground">สร้างเมนูทางลัดที่แสดงในแชต LINE ของร้าน</p></CardHeader>
      <CardContent>
        <form action={menuAction} className="space-y-3">
          <input type="hidden" name="liffUrl" value={liffUrl} />
          <Button type="submit" disabled={menuPending || !config.liffId}>{menuPending ? "กำลังตั้งค่า…" : "ตั้งค่า Rich Menu"}</Button>
          {config.richMenuSet && <span className="ml-3 text-sm text-muted-foreground">ตั้งค่า Rich Menu แล้ว</span>}
          <Result state={menuState} />
        </form>
      </CardContent>
    </Card>
  </div>;
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue} autoComplete="off" /></div>;
}

function SecretField({ label, name, configured }: { label: string; name: string; configured: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label>
    <Input id={name} name={name} type="password" placeholder={configured ? "ตั้งค่าแล้ว — เว้นว่างเพื่อใช้ค่าเดิม" : "กรอกค่า"} autoComplete="new-password" />
    {configured && <p className="text-xs text-muted-foreground">ตั้งค่าแล้ว</p>}
  </div>;
}
