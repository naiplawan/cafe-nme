"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { priceCart, rewardDiscount, type CartLineInput, type PosMenu } from "@/lib/pricing";
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
import { getPosDeviceId, lookupMemberById } from "@/app/pos/actions";
import { deserializeCart, serializeCart, validateCart, type CartSnapshot } from "@/lib/cart-storage";

type PosAppProps = { shop: PosShop; staff: { id: string; name: string; role: "owner" | "manager" | "barista" }; menu: PosMenu; orderNo: number; logoUrl: string | null };
type PaidOrder = { result: CheckoutResult; method: "cash" | "promptpay" };

export function PosApp({ shop, staff, menu, orderNo: initialOrderNo, logoUrl }: PosAppProps) {
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLineInput[]>([]);
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberLookupError, setMemberLookupError] = useState("");
  const [redeemRewardId, setRedeemRewardId] = useState<string | null>(null);
  const [modifierProductId, setModifierProductId] = useState<string | null>(null);
  const [modifierLineIndex, setModifierLineIndex] = useState<number | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paidOrder, setPaidOrder] = useState<PaidOrder | null>(null);
  const [online, setOnline] = useState(true);
  const [recentAddedProduct, setRecentAddedProduct] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [storageKey, setStorageKey] = useState<string | null>(null);
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
      if (active) setStorageKey(`cafe-pos-cart:${deviceId}:${staff.id}`);
    }).catch(() => {
      if (active) {
        storageReadyRef.current = true;
        setStorageReady(true);
      }
    });
    return () => { active = false; };
  }, [staff.id]);

  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    let snapshot: CartSnapshot | null = null;
    try {
      snapshot = deserializeCart(window.sessionStorage.getItem(storageKey));
    } catch {
      snapshot = null;
    }
    const restore = async () => {
      if (snapshot) {
        const validated = validateCart(snapshot, menu);
        if (!active) return;
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
    void restore();
    return () => { active = false; };
  }, [menu, storageKey]);

  useEffect(() => {
    if (!storageReady || !storageReadyRef.current || !storageKey) return;
    try {
      if (paidOrder || (!cart.length && !member && !redeemRewardId)) window.sessionStorage.removeItem(storageKey);
      else {
        const snapshot: CartSnapshot = { lines: cart, memberId: member?.id ?? null, redeemRewardId };
        window.sessionStorage.setItem(storageKey, serializeCart(snapshot));
      }
    } catch {
      // Storage can be unavailable in private browsing; the POS remains usable.
    }
  }, [cart, member, paidOrder, redeemRewardId, storageKey, storageReady]);

  useEffect(() => {
    if (!cartNotice) return;
    const timer = window.setTimeout(() => setCartNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);

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

  function changeQuantity(index: number, delta: number) {
    setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, qty: line.qty + delta } : line).filter((line) => line.qty > 0));
  }

  function attachMember(nextMember: MemberSummary) {
    setMember(nextMember);
    setMemberLoading(false);
    setMemberLookupError("");
    setRedeemRewardId(null);
  }

  const staffRole = staff.role === "owner" ? "เจ้าของ" : staff.role === "manager" ? "ผู้จัดการ" : "บาริสต้า";
  if (paidOrder) return <DoneScreen result={paidOrder.result} method={paidOrder.method} onNewOrder={() => {
    clearSavedCart();
    setCart([]); setMember(null); setRedeemRewardId(null); setPaidOrder(null);
    setOrderNo(paidOrder.result.dailyNo + 1);
  }} />;

  return <div className="flex h-dvh min-h-[600px] flex-col overflow-hidden bg-[#F5EDE3]">
    <PosHeader shopName={shop.name} orderNo={orderNo} staffName={staff.name} staffRole={staffRole} online={online} logoUrl={logoUrl} onLogout={clearSavedCart} />
    <div className="flex min-h-0 flex-1">
      <CategoryRail menu={menu} selectedId={categoryId} onSelect={setCategoryId} />
      <ProductGrid menu={menu} categoryId={categoryId} addedProductId={recentAddedProduct} onChoose={(productId) => {
        // Items without add-ons (e.g. bakery) go straight into the order.
        if (menu.products.find((product) => product.id === productId)?.groups.length === 0) addLine(productId, [], 1);
        else setModifierProductId(productId);
      }} />
      <CartPanel lines={cart} pricedLines={pricing.lines} subtotalSatang={pricing.subtotalSatang} discountSatang={discountSatang}
        totalSatang={totalSatang} menu={menu} member={member} memberLoading={memberLoading} memberLookupError={memberLookupError} redeemRewardId={redeemRewardId} online={online} onQuantity={changeQuantity}
        onEdit={(index) => { setModifierLineIndex(index); setModifierProductId(cart[index]?.productId ?? null); }}
        onScan={() => { setMemberLookupError(""); setShowScan(true); }} onPhone={() => { setMemberLookupError(""); setShowPhone(true); }} onRemoveMember={() => { setMember(null); setRedeemRewardId(null); }}
        onToggleReward={() => setRedeemRewardId((current) => current ? null : member?.availableRewards[0]?.id ?? null)}
        onPay={() => { if (cart.length && online) setShowPayment(true); }} />
    </div>
    {modifierProduct && <ModifierSheet key={`${modifierProduct.id}:${modifierLineIndex ?? "new"}`} product={modifierProduct}
      initialModifierIds={modifierLineIndex === null ? [] : cart[modifierLineIndex]?.modifierIds}
      initialQty={modifierLineIndex === null ? 1 : cart[modifierLineIndex]?.qty}
      isEditing={modifierLineIndex !== null}
      onClose={() => { setModifierProductId(null); setModifierLineIndex(null); }}
      onConfirm={(modifierIds, qty) => modifierLineIndex === null ? addLine(modifierProduct.id, modifierIds, qty) : replaceLine(modifierLineIndex, modifierIds, qty)}
      onRemove={modifierLineIndex === null ? undefined : () => {
        setCart((current) => current.filter((_, index) => index !== modifierLineIndex));
        setModifierProductId(null);
        setModifierLineIndex(null);
      }} />}
    {showScan && <ScanDialog onClose={() => setShowScan(false)} onAttach={attachMember} onLookupStart={() => { setMemberLookupError(""); setMemberLoading(true); }} onLookupEnd={(error) => { setMemberLoading(false); setMemberLookupError(error ?? ""); }} />}
    {showPhone && <PhoneDialog onClose={() => setShowPhone(false)} onAttach={attachMember} />}
    {showPayment && <PaymentDialog orderLabel={`#${String(orderNo).padStart(3, "0")}`}
      lines={pricing.lines.map((line, index) => ({ key: `${line.productId}-${index}`, name: line.name, qty: line.qty,
        modifiersText: line.modifiers.map((modifier) => modifier.name).join(" · "), lineTotalSatang: line.lineTotalSatang }))}
      subtotalSatang={pricing.subtotalSatang} discountSatang={discountSatang} totalSatang={totalSatang}
      checkoutInput={{ lines: cart, memberId: member?.id ?? null, redeemRewardId }} promptpayEnabled={Boolean(shop.promptpayId)}
      shopName={shop.name} onClose={() => setShowPayment(false)} onPaid={(result, method) => { clearSavedCart(); setShowPayment(false); setPaidOrder({ result, method }); }} />}
    {cartNotice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#3B2A20] px-5 py-3 text-base font-semibold text-white shadow-xl">{cartNotice}</div>}
  </div>;
}
