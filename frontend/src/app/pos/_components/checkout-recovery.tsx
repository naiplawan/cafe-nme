"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { checkoutAction } from "@/app/pos/checkout-actions";
import { submitPendingCheckout, type PendingCheckoutInput } from "@/lib/checkout-attempt";
import type { CheckoutResult } from "@/server/orders";

interface CheckoutRecoveryProps {
  pending: PendingCheckoutInput;
  cartStorageKey?: string | null;
  onRecovered: (result: CheckoutResult, method: "cash" | "promptpay") => void;
  onRejected: (message: string) => void;
}

export function CheckoutRecovery({ pending, cartStorageKey = null, onRecovered, onRejected }: CheckoutRecoveryProps) {
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function recover() {
    if (active.current) { return; }
    active.current = true;
    setBusy(true);
    try {
      let storage: Storage | null = null;
      try { storage = window.sessionStorage; } catch { /* Submission fails before the API when storage is unavailable. */ }
      const outcome = await submitPendingCheckout(pending, storage, cartStorageKey, checkoutAction);
      if (outcome.kind === "completed") { onRecovered(outcome.result, pending.payment.method); }
      else if (outcome.kind === "rejected") { onRejected(outcome.message); }
      else { setMessage(outcome.message); }
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-[#F5EDE3] p-6 text-[#3B2A20]">
    <section className="w-full max-w-[560px] space-y-5 rounded-[24px] border border-[#E4D6C6] bg-[#FFFBF6] p-7 text-center shadow-[0_12px_36px_rgba(59,42,32,0.08)]" aria-live="polite" aria-busy={busy}>
      <h1 className="text-2xl font-bold">พบรายการชำระเงินที่ยังไม่ยืนยัน</h1>
      <p className="text-base text-[#6B5547]">ระบบจะตรวจสอบรายการเดิมด้วยรหัสเดิม เพื่อป้องกันการบันทึกซ้ำ</p>
      <Link href="/pos/login" className="inline-flex min-h-11 items-center text-sm font-semibold underline">เข้าสู่ระบบด้วยพนักงานที่รับรายการเดิม</Link>
      {message ? <p role="alert" className="text-sm font-semibold text-[#8E3415]">{message}</p> : null}
      <button type="button" disabled={busy} onClick={() => void recover()} className="h-16 w-full rounded-2xl bg-[#2F6B3F] text-lg font-bold text-white disabled:opacity-60">
        {busy ? "กำลังตรวจสอบ…" : "ตรวจสอบรายการเดิมอีกครั้ง"}
      </button>
    </section>
  </main>;
}
