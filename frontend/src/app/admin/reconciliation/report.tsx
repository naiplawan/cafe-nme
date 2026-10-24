import { randomUUID } from "node:crypto";
import { formatBaht } from "@/lib/money";
import { ReviewForm } from "./form";
export interface ReviewRow {
  paymentId: string; dailyNo: number; method: "cash" | "promptpay";
  expectedSatang: number; observedSatang: number | null; differenceSatang: number | null;
  status: "pending" | "matched" | "discrepancy"; recordedBy: string | null;
  reviewedBy: string | null; reviewedAt: string | null; source: "staff" | "provider" | null; note: string | null;
}
const labels={pending:"รอตรวจ",matched:"ยอดตรง · ยืนยันโดยผู้ให้บริการ",discrepancy:"ยอดไม่ตรง · ตรวจโดยพนักงาน"};
export function ReconciliationReport({rows}:{rows:ReviewRow[]}) {
  return <div className="space-y-8">{(["cash","promptpay"] as const).map(method=>{
    const payments=rows.filter(row=>row.method===method);
    const expected=payments.reduce((sum,row)=>sum+row.expectedSatang,0);
    const pending=payments.filter(row=>row.status==="pending");
    const shortages=payments.reduce((sum,row)=>sum+Math.max(0,-(row.differenceSatang??0)),0);
    const excess=payments.reduce((sum,row)=>sum+Math.max(0,row.differenceSatang??0),0);
    return <section key={method} className="space-y-4" aria-label={method==="cash"?"เงินสด":"PromptPay"}>
      <header className="rounded-xl border bg-card p-4"><h2 className="text-xl font-semibold">{method==="cash"?"เงินสด":"PromptPay"}</h2>
        <p>ยอดขาย {formatBaht(expected)}</p>
        <p>{`รอตรวจ ${pending.length} บิล · ${formatBaht(pending.reduce((sum,row)=>sum+row.expectedSatang,0))}`}</p>
        <p>{`ขาด ${formatBaht(shortages)} · เกิน ${formatBaht(excess)}`}</p>
      </header>
      {payments.length===0?<p className="text-muted-foreground">ไม่มีบิลในวันที่เลือก</p>:payments.map(row=><article key={row.paymentId} className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">บิล #{row.dailyNo} · {formatBaht(row.expectedSatang)}</h3><p>{labels[row.status]}</p></div>
        <p className="text-sm">ผู้รับเงิน: {row.recordedBy??"ไม่ระบุ"}</p>
        {row.observedSatang!==null?<p>ตรวจพบ {formatBaht(row.observedSatang)} · ส่วนต่าง {formatBaht(row.differenceSatang??0)}</p>:null}
        {row.source === "provider" ? <p className="text-sm">แหล่งยืนยัน: ผู้ให้บริการ Omise · {row.note}</p> : null}
        {row.reviewedBy?<p className="text-sm">ผู้ตรวจ: {row.reviewedBy} · {row.reviewedAt}</p>:null}
        {row.note?<p className="text-sm">{row.note}</p>:null}
        <details><summary className="min-h-11 cursor-pointer py-3 font-medium">{row.status==="pending"?"ตรวจยอดรับเงินจริง":"บันทึกผลตรวจใหม่"}</summary><ReviewForm paymentId={row.paymentId} requestId={randomUUID()}/></details>
      </article>)}
    </section>;
  })}</div>;
}
