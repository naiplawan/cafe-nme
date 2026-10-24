"use client";
import { useActionState } from "react";
import type { RefundDetail } from "@/server/refunds";
import { formatBaht } from "@/lib/money";
import { refundAction,payoutAction } from "../actions";
const field="min-h-11 rounded-lg border bg-background px-3";
export function RefundForm({detail,requestId}:{detail:RefundDetail;requestId:string}) {
 const [state,action,pending]=useActionState(refundAction,{message:null});
 return <form action={action} className="space-y-4"><input type="hidden" name="orderId" value={detail.order.id}/><input type="hidden" name="requestId" value={requestId}/>
 <h2 className="text-xl font-semibold">เลือกจำนวนที่จะคืน</h2><p className="text-sm">ส่วนลดเฉลี่ยตามมูลค่ารายการ ยอดคืนรวมไม่เกินยอดชำระ การอนุมัติยังไม่ใช่การจ่ายเงินคืน</p>
 {detail.items.map(item=>{const returned=detail.refunds.flatMap(r=>r.lines).filter(l=>l.itemId===item.id).reduce((n,l)=>n+l.qty,0);const remaining=item.qty-returned;return <label key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><span>{item.name} · คืนได้อีก {remaining} / {item.qty}{item.paidSatang!==null?` · จ่ายรวม ${formatBaht(item.paidSatang)}`:""}</span><input aria-label={`จำนวนคืน ${item.name}`} name={`qty:${item.id}`} type="number" min={0} max={remaining} defaultValue={0} disabled={remaining===0} className={`${field} w-24`}/></label>;})}
 <label className="grid gap-1">เหตุผล<textarea name="reason" required maxLength={500} className={`${field} py-2`}/></label>
 <button type="submit" disabled={pending||detail.order.status!=="paid"} className="min-h-12 rounded-lg bg-primary px-5 text-primary-foreground disabled:opacity-50">{pending?"กำลังบันทึก…":"อนุมัติคืนรายการที่เลือก"}</button>
 {state.message?<p role={state.success?"status":"alert"}>{state.message}</p>:null}</form>;
}
export function PayoutForm({orderId,refundId}:{orderId:string;refundId:string}) {
 const [state,action,pending]=useActionState(payoutAction,{message:null});
 return <form action={action} className="grid gap-3"><input type="hidden" name="orderId" value={orderId}/><input type="hidden" name="refundId" value={refundId}/>
 <label className="grid gap-1">วิธีจ่ายคืน<select name="method" className={field}><option value="cash">เงินสดจากกะที่เปิดอยู่</option><option value="promptpay">PromptPay ที่โอนคืนแล้ว</option></select></label>
 <label className="grid gap-1">อ้างอิงการส่งมอบ / โอนคืน<input name="reference" required maxLength={200} className={field}/></label>
 <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="paidInReality" value="yes" required/>ฉันจ่ายเงินจริงคืนให้ลูกค้าแล้ว</label>
 <p className="text-sm">ปุ่มนี้บันทึกการจ่ายโดยพนักงาน ระบบไม่โอนเงินให้</p>
 <button type="submit" disabled={pending} className="min-h-11 rounded-lg border px-4">{pending?"กำลังบันทึก…":"บันทึกการจ่ายคืนจริง"}</button>
 {state.message?<p role={state.success?"status":"alert"}>{state.message}</p>:null}</form>;
}
