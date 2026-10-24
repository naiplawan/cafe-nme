"use client";
import { useState, useTransition } from "react";
import type { ProviderPaymentView } from "@/server/provider-payments";
import { refreshProviderPaymentAction, startProviderPaymentAction } from "./payment-actions";

const labels: Record<ProviderPaymentView["status"], string> = {
  not_started: "ยังไม่เริ่มชำระ", creating: "กำลังสร้าง QR", uncertain: "กำลังตรวจสอบรายการเดิม ห้ามรับเงินซ้ำ",
  pending: "รอผู้ให้บริการยืนยัน", verified: "ผู้ให้บริการตรวจสอบการชำระแล้ว", paid_unfulfilled: "ได้รับเงินแล้ว แต่ยังออกบิลไม่สำเร็จ กรุณาติดต่อผู้ดูแล",
  discrepancy: "ยอดหรือข้อมูลไม่ตรง กรุณาตรวจสอบ", completed: "รับชำระและออกบิลสำเร็จ", failed: "รายการชำระไม่สำเร็จ", expired: "QR หมดอายุ",
};
export function ProviderPaymentPanel({ id, initial }: { id: string; initial: ProviderPaymentView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  function run(action: "create" | "refresh") {
    startTransition(async () => {
      setError("");
      const result = action === "create" ? await startProviderPaymentAction(id) : await refreshProviderPaymentAction(id);
      if (result.ok) { setView(result.view); } else { setError(result.message); }
    });
  }
  return <section aria-live="polite" aria-busy={busy} className="space-y-4 rounded-2xl border bg-card p-5">
    <h2 className="text-lg font-semibold">ชำระผ่าน PromptPay</h2>
    {view.testMode ? <p className="rounded-lg bg-amber-100 p-3">โหมดทดสอบเท่านั้น ยังไม่มีการตัดเงินจริง</p> : null}
    <p role="status">{labels[view.status]}</p>
    {view.amountSatang !== null ? <p className="text-xl font-bold">ยอด ฿{(view.amountSatang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p> : null}
    {view.qrImageUrl ? <div className="space-y-2"><img src={view.qrImageUrl} alt="QR PromptPay จากผู้ให้บริการชำระเงิน" width={256} height={256} className="size-64 rounded-xl border bg-white object-contain" /><p className="text-sm">สแกนเพื่อชำระ แล้วกดตรวจสถานะได้ ระบบจะยืนยันจากผู้ให้บริการ</p></div> : null}
    {view.dailyNo ? <p>ออกบิลแล้ว · คิว #{view.dailyNo}</p> : null}
    {error ? <p role="alert" className="text-red-800">{error}</p> : null}
    {view.status === "not_started" && view.configured ? <button type="button" disabled={busy} onClick={() => run("create")} className="min-h-12 rounded-xl bg-primary px-5 text-primary-foreground">สร้าง QR รับชำระ</button> : null}
    {["pending", "uncertain", "verified", "paid_unfulfilled", "discrepancy"].includes(view.status) ? <button type="button" disabled={busy} onClick={() => run("refresh")} className="min-h-12 rounded-xl border px-5">{busy ? "กำลังตรวจสอบ…" : "ตรวจสถานะกับผู้ให้บริการ"}</button> : null}
    {!view.configured ? <p>ร้านยังไม่ได้ตั้งค่าบัญชีผู้ให้บริการ · สามารถกลับไปรับชำระด้วยวิธีเดิม</p> : null}
  </section>;
}
