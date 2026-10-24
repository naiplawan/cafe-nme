export function allocateLinePayments(gross: number[], paid: number): number[] {
  const total=gross.reduce((sum,value)=>sum+value,0);
  if (!Number.isSafeInteger(paid) || paid<0 || paid>total || gross.some(value=>!Number.isSafeInteger(value)||value<0)) {
    throw new RangeError("Invalid line payment allocation");
  }
  let cumulative=0; let allocated=0;
  return gross.map(value=>{
    cumulative+=value;
    const target=total===0?0:Number(BigInt(cumulative)*BigInt(paid)/BigInt(total));
    const amount=target-allocated; allocated=target; return amount;
  });
}
export function refundQuantityAmount(paid: number, sold: number, alreadyRefunded: number, quantity: number): number {
  if (![paid,sold,alreadyRefunded,quantity].every(Number.isSafeInteger) || paid<0 || sold<1 || alreadyRefunded<0 || quantity<1 || alreadyRefunded+quantity>sold) {
    throw new RangeError("Invalid refund quantity");
  }
  return Number(BigInt(paid)*BigInt(alreadyRefunded+quantity)/BigInt(sold)-BigInt(paid)*BigInt(alreadyRefunded)/BigInt(sold));
}
