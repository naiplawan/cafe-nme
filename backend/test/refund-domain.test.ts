import assert from "node:assert/strict";
import test from "node:test";
import { allocateLinePayments, refundQuantityAmount } from "../src/refund-domain.js";
test("allocates receipt discount proportionally while conserving satang",()=>{
 assert.deepEqual(allocateLinePayments([6500,3500],9000),[5850,3150]);
 assert.deepEqual(allocateLinePayments([1,1,1],2),[0,1,1]);
 assert.deepEqual(allocateLinePayments([0],0),[0]);
});
test("partial quantity refunds conserve rounding until the final unit",()=>{
 assert.equal(refundQuantityAmount(10000,3,0,1),3333);
 assert.equal(refundQuantityAmount(10000,3,1,1),3333);
 assert.equal(refundQuantityAmount(10000,3,2,1),3334);
 assert.throws(()=>refundQuantityAmount(10000,3,2,2));
});
