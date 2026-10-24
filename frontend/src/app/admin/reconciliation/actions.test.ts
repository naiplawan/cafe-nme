import { beforeEach, expect, it, vi } from "vitest";
const { requireStaff, reviewPayment }=vi.hoisted(()=>({requireStaff:vi.fn(),reviewPayment:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireStaff}));
vi.mock("@/server/reconciliation",()=>({reviewPayment}));
vi.mock("@/lib/logger",()=>({logger:{error:vi.fn()}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { reviewPaymentAction } from "./actions";
const paymentId="11111111-1111-4111-8111-111111111111";
const requestId="22222222-2222-4222-8222-222222222222";
function form() { const data=new FormData(); for (const [k,v] of Object.entries({paymentId,requestId,observed:"65.50",note:"checked",shopId:"foreign"})) { data.set(k,v); }return data; }
beforeEach(()=>{vi.resetAllMocks();requireStaff.mockResolvedValue({shopId:"actual-shop",staff:{id:"actual-actor",role:"manager"}});reviewPayment.mockResolvedValue({id:requestId});});
it("uses authenticated shop and actor and converts money without trusting submitted shop",async()=>{
  expect((await reviewPaymentAction({message:null},form())).success).toBe(true);
  expect(reviewPayment).toHaveBeenCalledWith("actual-shop","actual-actor",paymentId,{requestId,observedSatang:6550,note:"checked"});
});
it("denies barista and invalid amount before changing payment",async()=>{
  requireStaff.mockResolvedValueOnce({shopId:"actual-shop",staff:{id:"actor",role:"barista"}});
  expect((await reviewPaymentAction({message:null},form())).success).not.toBe(true);
  const invalid=form();invalid.set("observed","-1");
  expect((await reviewPaymentAction({message:null},invalid)).success).not.toBe(true);
  expect(reviewPayment).not.toHaveBeenCalled();
});
it("does not report success after API failure",async()=>{
  reviewPayment.mockRejectedValue(new Error("database unavailable"));
  const result=await reviewPaymentAction({message:null},form());
  expect(result.success).toBe(false);expect(result.message).not.toContain("database unavailable");
});
