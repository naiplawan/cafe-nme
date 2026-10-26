"use client";

import Link from "next/link";
import { formatBaht } from "@/lib/money";
import { useEffect, useMemo, useRef, useState } from "react";
import { hasSoldOutLine, priceCart, rewardDiscount, type CartLineInput, type PosMenu } from "@/lib/pricing";
import type { MemberSummary } from "@/server/loyalty";
import type { CheckoutResult } from "@/server/orders";
import type { PosShop } from "@/server/pos-session";
import { CartPanel } from "@/app/pos/_components/cart-panel";
import { CategoryRail } from "@/app/pos/_components/category-rail";
import { DoneScreen } from "@/app/pos/_components/done-screen";
import { ModifierSheet } from "@/app/pos/_components/modifier-sheet";
import { PaymentDialog } from "@/app/pos/_components/payment-dialog";
import { PhoneDialog } from "@/app/pos/_components/phone-dialog";
import { PosHeader } from "@/app/pos/_components/pos-header";
import { ProductGrid } from "@/app/pos/_components/product-grid";
import { ScanDialog } from "@/app/pos/_components/scan-dialog";
import { CheckoutRecovery } from "@/app/pos/_components/checkout-recovery";
import { getPosDeviceId, lookupMemberById } from "@/app/pos/actions";
import { getCheckoutStorage, resolveBrowserCheckout } from "@/lib/browser-checkout";
import { deserializeCart, serializeCart, validateCart, type CartSnapshot } from "@/lib/cart-storage";
import type { CheckoutSessionScope, PendingCheckoutInput } from "@/lib/checkout-attempt";

type PosAppProps = { cashShiftOpen?: boolean | null; acceptedSelfOrder?: { id: string; lines: CartLineInput[]; totalSatang: number } | null; selfOrderError?: string; shop: PosShop; staff: { id: string; name: string; role: "owner" | "manager" | "barista" }; menu: PosMenu; orderNo: number; logoUrl: string | null };
type PaidOrder = { result: CheckoutResult; method: "cash" | "promptpay" };

export function PosApp({ shop, staff, menu, orderNo: initialOrderNo, logoUrl, acceptedSelfOrder = null, selfOrderError, cashShiftOpen = null }: PosAppProps) {
  const [selfOrderId, setSelfOrderId] = useState<string | undefined>();
  const importedSource = useRef<string | null>(null);
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [removedLine, setRemovedLine] = useState<{ line: CartLineInput; index: number } | null>(null);
  const [cart, setCart] = useState<CartLineInput[]>([]);
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberLookupError, setMemberLookupError] = useState("");
  const [redeemRewardId, setRedeemRewardId] = useState<string | null>(null);
  const [modifierProductId, setModifierProductId] = useState<string | null>(null);
  const [modifierLineIndex, setModifierLineIndex] = useState<number | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paidOrder, setPaidOrder] = useState<PaidOrder | null>(null);
  const [online, setOnline] = useState(true);
  const [recentAddedProduct, setRecentAddedProduct] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [checkoutScope, setCheckoutScope] = useState<CheckoutSessionScope | null>(null);
  const [recoveryStorageKey, setRecoveryStorageKey] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckoutInput | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const storageReadyRef = useRef(false);
  const modifierProduct = menu.products.find((product) => product.id === modifierProductId) ?? null;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    let active = true;
    void getPosDeviceId().then((deviceId) => {
      if (active) {
        setCheckoutScope({ shopId: shop.id, staffId: staff.id, deviceId });
        setStorageKey(`cafe-pos-cart:${deviceId}:${staff.id}`);
      }
    }).catch(() => {
      if (active) {
        setStorageBlocked(true);
        storageReadyRef.current = true;
        setStorageReady(true);
      }
    });
    return () => { active = false; };
  }, [shop.id, staff.id]);

  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    const hasPendingCheckout = pendingCheckout !== null;
    if (paidOrder) {
      storageReadyRef.current = true;
      setStorageReady(true);
      return () => { active = false; };
    }
    const storage = getCheckoutStorage();
    if (!storage) {
      setStorageBlocked(true);
      storageReadyRef.current = false;
      setStorageReady(true);
      return () => { active = false; };
    }
    setStorageBlocked(false);
    storageReadyRef.current = false;
    setStorageReady(false);
    const initialize = async () => {
      const pending = await resolveBrowserCheckout(storageKey);
      if (!active) return;
      if (!pending.available) {
        setStorageBlocked(true);
        storageReadyRef.current = false;
        setStorageReady(true);
        return;
      }
      if (pending.input) {
        setRecoveryStorageKey(pending.cartStorageKey);
        if (!hasPendingCheckout) setPendingCheckout(pending.input);
        storageReadyRef.current = true;
        setStorageReady(true);
        return;
      }
      if (hasPendingCheckout) setPendingCheckout(null);
      let snapshot: CartSnapshot | null = null;
      try {
        snapshot = deserializeCart(storage?.getItem(storageKey) ?? null);
      } catch {
        setStorageBlocked(true);
        storageReadyRef.current = false;
        setStorageReady(true);
        return;
      }
      if (acceptedSelfOrder && importedSource.current !== acceptedSelfOrder.id) {
        if (!snapshot || (snapshot.lines.length === 0 && !snapshot.memberId && !snapshot.redeemRewardId)) {
          snapshot = { selfOrderId: acceptedSelfOrder.id, lines: acceptedSelfOrder.lines, memberId: null, redeemRewardId: null };
        } else if (snapshot.selfOrderId !== acceptedSelfOrder.id) {
          setCartNotice("มีตะกร้าเดิมอยู่ กรุณาจัดการรายการเดิมก่อนนำรายการจาก QR เข้ามา");
        }
        importedSource.current = acceptedSelfOrder.id;
      }
      const restore = async () => {
        if (snapshot) {
          const validated = validateCart(snapshot, menu);
          if (!active) return;
          setSelfOrderId(validated.snapshot.selfOrderId);
          setCart(validated.snapshot.lines);
          setRedeemRewardId(validated.snapshot.redeemRewardId);
          if (validated.dropped) setCartNotice("บางรายการไม่มีขายแล้ว จึงถูกนำออก");
          if (validated.snapshot.memberId) {
            try {
              const restoredMember = await lookupMemberById(validated.snapshot.memberId);
              if (active && restoredMember) setMember(restoredMember);
              else if (active) setRedeemRewardId(null);
            } catch {
              if (active) setRedeemRewardId(null);
            }
          }
        }
        if (active) {
          storageReadyRef.current = true;
          setStorageReady(true);
        }
      };
      await restore();
    };
    void initialize();
    return () => { active = false; };
  }, [acceptedSelfOrder, menu, paidOrder, pendingCheckout, storageKey]);

  useEffect(() => {
    if (storageBlocked || !storageReady || !storageReadyRef.current || !storageKey || pendingCheckout) return;
    try {
      if (paidOrder || (!cart.length && !member && !redeemRewardId)) window.sessionStorage.removeItem(storageKey);
      else {
        const snapshot: CartSnapshot = { ...(selfOrderId ? { selfOrderId } : {}), lines: cart, memberId: member?.id ?? null, redeemRewardId };
        getCheckoutStorage()?.setItem(storageKey, serializeCart(snapshot));
      }
    } catch {
      // Storage can be unavailable in private browsing; the POS remains usable.
    }
  }, [cart, member, paidOrder, pendingCheckout, redeemRewardId, selfOrderId, storageBlocked, storageKey, storageReady]);

  useEffect(() => {
    if (!cartNotice) return;
    const timer = window.setTimeout(() => setCartNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);

  useEffect(() => {
    if (!removedLine) { return; }
    const timer = window.setTimeout(() => setRemovedLine(null), 5000);
    return () => window.clearTimeout(timer);
  }, [removedLine]);

  function clearSavedCart() {
    if (!storageKey) return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }

  const pricing = useMemo(() => {
    try { return priceCart(cart, menu); }
    catch { return { lines: [], subtotalSatang: 0 }; }
  }, [cart, menu]);
  const discountSatang = redeemRewardId ? Math.min(pricing.subtotalSatang, rewardDiscount(pricing.lines)) : 0;
  const totalSatang = Math.max(0, pricing.subtotalSatang - discountSatang);

  function addLine(productId: string, modifierIds: string[], qty: number) {
    const sortedIds = [...modifierIds].sort();
    setCart((current) => {
      const existingIndex = current.findIndex((line) => line.productId === productId &&
        [...line.modifierIds].sort().join("\u0000") === sortedIds.join("\u0000"));
      if (existingIndex < 0) return [...current, { productId, qty, modifierIds: sortedIds }];
      return current.map((line, index) => index === existingIndex ? { ...line, qty: Math.min(99, line.qty + qty) } : line);
    });
    setRecentAddedProduct(`${productId}:${Date.now()}`);
    setModifierProductId(null);
    setModifierLineIndex(null);
  }

  function replaceLine(index: number, modifierIds: string[], qty: number) {
    const sortedIds = [...modifierIds].sort();
    setCart((current) => {
      const original = current[index];
      if (!original) return current;
      const replacement = { ...original, qty, modifierIds: sortedIds };
      const matchingIndex = current.findIndex((line, lineIndex) => lineIndex !== index && line.productId === replacement.productId &&
        (line.note ?? "") === (replacement.note ?? "") && [...line.modifierIds].sort().join("\u0000") === sortedIds.join("\u0000"));
      if (matchingIndex < 0) return current.map((line, lineIndex) => lineIndex === index ? replacement : line);
      const next = [...current];
      next.splice(index, 1);
      const targetIndex = matchingIndex > index ? matchingIndex - 1 : matchingIndex;
      next[targetIndex] = { ...next[targetIndex], qty: Math.min(99, next[targetIndex].qty + qty) };
      return next;
    });
    setModifierProductId(null);
    setModifierLineIndex(null);
  }

  function removeLine(index: number) {
    const line = cart[index];
    if (!line) { return; }
    setRemovedLine({ line, index });
    setCart((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  function undoRemoval() {
    if (!removedLine) { return; }
    const { line, index } = removedLine;
    setCart((current) => {
      const matching = current.findIndex((item) => item.productId === line.productId && (item.note ?? "") === (line.note ?? "") && [...item.modifierIds].sort().join(",") === [...line.modifierIds].sort().join(","));
      if (matching >= 0) { return current.map((item, lineIndex) => lineIndex === matching ? { ...item, qty: Math.min(99, item.qty + line.qty) } : item); }
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, line);
      return next;
    });
    setRemovedLine(null);
  }

  function changeQuantity(index: number, delta: number) {
    if (cart[index]?.qty === 1 && delta === -1) { removeLine(index); return; }
    setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, qty: line.qty + delta } : line).filter((line) => line.qty > 0));
  }

  function attachMember(nextMember: MemberSummary) {
    setMember(nextMember);
    setMemberLoading(false);
    setMemberLookupError("");
    setRedeemRewardId(null);
  }

  const staffRole = staff.role === "owner" ? "เจ้าของ" : staff.role === "manager" ? "ผู้จัดการ" : "บาริสต้า";
  function onRecoveredCheckout(result: CheckoutResult, method: "cash" | "promptpay") {
    if (pendingCheckout?.selfOrderId) { setSelfOrderId(pendingCheckout.selfOrderId); }
    setPendingCheckout(null);
    setPaidOrder({ result, method });
  }

  function rejectPendingCheckout(message: string) {
    setPendingCheckout(null);
    setCartNotice(message);
    storageReadyRef.current = false;
    setStorageReady(false);
  }

  if (paidOrder) return <DoneScreen result={paidOrder.result} method={paidOrder.method} onNewOrder={() => {
    clearSavedCart();
    if (selfOrderId) { window.location.assign("/pos"); return; }
    setCart([]); setMember(null); setRedeemRewardId(null); setPaidOrder(null);
    setOrderNo(paidOrder.result.dailyNo + 1);
  }} />;
  if (storageBlocked) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#F7F1E7] p-6 text-[#4A2C1A]"><section className="w-full max-w-[520px] space-y-4 rounded-[24px] border border-[#E2D8C7] bg-[#FFFFFF] p-7 text-center shadow-[0_12px_36px_rgba(59,42,32,0.08)]"><h1 className="text-xl font-bold">ยังเปิดออเดอร์ไม่ได้</h1><p role="alert" className="text-sm text-[#8E3415]">ไม่สามารถอ่านพื้นที่จัดเก็บรายการได้ กรุณาลองใหม่</p><button type="button" onClick={() => window.location.reload()} className="h-14 w-full rounded-2xl bg-[#4A2C1A] text-base font-bold text-[#F7F1E7]">ลองใหม่</button></section></main>;
  }
  if (!storageReady) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#F7F1E7] p-6 text-[#4A2C1A]"><p className="text-lg font-semibold">กำลังโหลดออเดอร์…</p></main>;
  }
  if (pendingCheckout) {
    return <CheckoutRecovery pending={pendingCheckout} cartStorageKey={recoveryStorageKey} onRecovered={onRecoveredCheckout} onRejected={rejectPendingCheckout} />;
  }

  // Only interrupt the sale screen when cash sales are blocked or unknown.
  const shiftBanner = cashShiftOpen ? null : <div role="status" className="shrink-0 bg-[#F7DCD0] px-5 py-2 text-sm text-[#8E3415]">
    {cashShiftOpen === false ? "ยังไม่เปิดกะเงินสด · เปิดกะก่อนรับเงินสด · พร้อมเพย์รับชำระได้ตามปกติ" : "ยังตรวจสอบกะเงินสดไม่ได้ · ตรวจสอบกะก่อนรับเงินสด"}
    <Link href="/pos/shifts" className="ml-3 inline-flex min-h-11 items-center rounded-xl border border-current px-3 font-semibold">{cashShiftOpen === false ? "เปิดกะเงินสด" : "ตรวจสอบกะเงินสด"}</Link>
  </div>;

  if (selfOrderId) {
    return <main className="min-h-dvh space-y-5 bg-[#F7F1E7] p-6 text-[#4A2C1A]">
      {shiftBanner}
      <section className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-[#E2D8C7] bg-[#FFFFFF] p-5 sm:p-7">
      <h1 className="text-2xl font-bold">รายการจาก QR · รับชำระเงิน</h1>
      <p>รับชำระตามรายการที่ลูกค้าส่งไว้ รายการนี้แก้ไขไม่ได้</p>
      {cartNotice ? <p role="alert">{cartNotice}</p> : null}
      <ul className="divide-y divide-[#E2D8C7]">{cart.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Accepted draft lines are immutable and never reordered.
        <li key={`${selfOrderId}:${index}`} className="flex justify-between gap-4 py-4"><div><p className="text-lg font-semibold">{line.qty} × {pricing.lines[index]?.name ?? menu.products.find((product) => product.id === line.productId)?.name ?? "เมนูไม่พร้อมขาย"}</p><p className="text-sm text-[#817668]">{pricing.lines[index]?.modifiers.map((modifier) => modifier.name).join(" · ")}</p>{line.note ? <p className="mt-1 text-sm text-[#817668]">{line.note}</p> : null}</div><span className="shrink-0 font-bold tabular-nums">{pricing.lines[index] ? formatBaht(pricing.lines[index].lineTotalSatang) : "ตรวจสอบราคา"}</span></li>))}</ul>
      <div className="flex items-baseline justify-between border-t border-[#E2D8C7] pt-4 font-bold"><span>ยอดชำระ</span><span className="text-3xl tabular-nums">{pricing.lines.length === cart.length ? formatBaht(pricing.subtotalSatang) : "รอตรวจสอบราคา"}</span></div>
      <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setShowPayment(true)} disabled={!online} className="min-h-14 rounded-xl bg-[#2F6B3F] px-6 text-lg font-bold text-white disabled:opacity-50">ตรวจสอบยอดและรับชำระเงิน</button>
      <Link href="/pos/requests" className="inline-flex min-h-14 items-center rounded-xl border border-[#E2D8C7] px-4 font-semibold">กลับรายการจาก QR</Link>
      {!showPayment ? <button type="button" onClick={() => { clearSavedCart(); window.location.assign("/pos"); }} className="min-h-14 rounded-xl border border-[#E2D8C7] px-4 font-semibold">พักรายการนี้และกลับขายปกติ</button> : null}
      </div></section>
      {showPayment && checkoutScope ? <PaymentDialog orderLabel={`#${String(orderNo).padStart(3, "0")}`}
        lines={pricing.lines.map((line) => ({ key: line.productId, name: line.name, qty: line.qty, modifiersText: line.modifiers.map((modifier) => modifier.name).join(" · "), lineTotalSatang: line.lineTotalSatang }))}
        subtotalSatang={pricing.subtotalSatang} discountSatang={0} totalSatang={pricing.subtotalSatang}
        checkoutInput={{ selfOrderId, lines: cart, memberId: null, redeemRewardId: null }} expectedScope={checkoutScope} cartStorageKey={storageKey} promptpayEnabled={Boolean(shop.promptpayId)}
        shopName={shop.name} onClose={() => setShowPayment(false)} onPaid={(result, method) => { setShowPayment(false); setPaidOrder({ result, method }); }} /> : null}
    </main>;
  }

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#F7F1E7]">
    {selfOrderError ? <p role="alert" className="bg-amber-100 p-3">{selfOrderError}</p> : null}
    <PosHeader shopName={shop.name} orderNo={orderNo} staffName={staff.name} staffRole={staffRole} online={online} logoUrl={logoUrl} />
    {shiftBanner}
    <div className="relative flex min-h-0 flex-1">
      {/* Overlays the content area so it never shifts the layout, covers the header, or blocks Pay. */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2 lg:bottom-5 lg:top-auto lg:left-[calc((100%-min(404px,34vw))/2)]">
        {removedLine && !showPayment ? <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#4A2C1A] px-4 py-2 text-[#F7F1E7] shadow-xl"><span>นำรายการออกแล้ว</span><button type="button" onClick={undoRemoval} className="min-h-11 rounded-lg border border-[#E2D8C7] px-3 font-bold">เลิกทำ</button></div> : null}
        {cartNotice ? <div role="status" className="rounded-xl bg-[#4A2C1A] px-5 py-3 text-base font-semibold text-white shadow-xl">{cartNotice}</div> : null}
      </div>
      <div className={`${showCart ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 flex-col md:flex-row lg:flex`}>
      <CategoryRail menu={menu} selectedId={categoryId} onSelect={setCategoryId} />
      <ProductGrid menu={menu} categoryId={categoryId} addedProductId={recentAddedProduct} onChoose={(productId) => {
        // Items without add-ons (e.g. bakery) go straight into the order.
        if (menu.products.find((product) => product.id === productId)?.groups.length === 0) addLine(productId, [], 1);
        else setModifierProductId(productId);
      }} />
      </div>
      <div className={`${showCart ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 lg:flex lg:flex-none`}>
      <CartPanel lines={cart} pricedLines={pricing.lines} subtotalSatang={pricing.subtotalSatang} discountSatang={discountSatang}
        totalSatang={totalSatang} menu={menu} member={member} memberLoading={memberLoading} memberLookupError={memberLookupError} redeemRewardId={redeemRewardId} online={online} onQuantity={changeQuantity}
        onEdit={(index) => { setModifierLineIndex(index); setModifierProductId(cart[index]?.productId ?? null); }}
        onScan={() => { setMemberLookupError(""); setShowScan(true); }} onPhone={() => { setMemberLookupError(""); setShowPhone(true); }} onRemoveMember={() => { setMember(null); setRedeemRewardId(null); }}
        onToggleReward={() => setRedeemRewardId((current) => current ? null : member?.availableRewards[0]?.id ?? null)}
        onPay={() => { if (cart.length > 100 || cart.reduce((count, line) => count + line.qty, 0) > 500) { setCartNotice("ออเดอร์ต้องไม่เกิน 100 รายการและ 500 ชิ้น กรุณาลดจำนวนหรือแยกออเดอร์"); return; } if (cart.length && online && !hasSoldOutLine(cart, menu)) { setRemovedLine(null); setShowPayment(true); } }} />
      </div>
    </div>
    <div className="sticky bottom-0 z-20 shrink-0 border-t border-[#E2D8C7] bg-[#FFFFFF] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <button type="button" aria-pressed={showCart} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-[#4A2C1A] px-4 font-bold text-[#F7F1E7]" onClick={() => setShowCart((value) => !value)}><span>{showCart ? "กลับไปเลือกเมนู" : "ดูตะกร้า"} ({cart.reduce((count, line) => count + line.qty, 0)} ชิ้น)</span><span className="tabular-nums">{formatBaht(totalSatang)}</span></button>
    </div>
    {modifierProduct && <ModifierSheet key={`${modifierProduct.id}:${modifierLineIndex ?? "new"}`} product={modifierProduct}
      initialModifierIds={modifierLineIndex === null ? [] : cart[modifierLineIndex]?.modifierIds}
      initialQty={modifierLineIndex === null ? 1 : cart[modifierLineIndex]?.qty}
      isEditing={modifierLineIndex !== null}
      onClose={() => { setModifierProductId(null); setModifierLineIndex(null); }}
      onConfirm={(modifierIds, qty) => modifierLineIndex === null ? addLine(modifierProduct.id, modifierIds, qty) : replaceLine(modifierLineIndex, modifierIds, qty)}
      onRemove={modifierLineIndex === null ? undefined : () => {
        removeLine(modifierLineIndex);
        setModifierProductId(null);
        setModifierLineIndex(null);
      }} />}
    {showScan && <ScanDialog onClose={() => setShowScan(false)} onAttach={attachMember} onLookupStart={() => { setMemberLookupError(""); setMemberLoading(true); }} onLookupEnd={(error) => { setMemberLoading(false); setMemberLookupError(error ?? ""); }} />}
    {showPhone && <PhoneDialog onClose={() => setShowPhone(false)} onAttach={attachMember} />}
    {showPayment && checkoutScope && <PaymentDialog orderLabel={`#${String(orderNo).padStart(3, "0")}`}
      lines={pricing.lines.map((line, index) => ({ key: `${line.productId}-${index}`, name: line.name, qty: line.qty,
        modifiersText: line.modifiers.map((modifier) => modifier.name).join(" · "), lineTotalSatang: line.lineTotalSatang }))}
      subtotalSatang={pricing.subtotalSatang} discountSatang={discountSatang} totalSatang={totalSatang}
      checkoutInput={{ lines: cart, memberId: member?.id ?? null, redeemRewardId }} expectedScope={checkoutScope} cartStorageKey={storageKey} promptpayEnabled={Boolean(shop.promptpayId)}
      shopName={shop.name} onClose={() => setShowPayment(false)} onPaid={(result, method) => { setShowPayment(false); setPaidOrder({ result, method }); }} />}
  </div>;
}
