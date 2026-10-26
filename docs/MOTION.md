# Motion & polish guidelines

GSAP 3.15 (all plugins free) is set up in `frontend/src/components/motion/gsap.ts`:
`import { gsap, useGSAP, Flip, DrawSVGPlugin, MOTION, prefersReducedMotion } from "@/components/motion/gsap";`
Never import from "gsap" directly in components (plugins must be registered once there).

## Rules
1. **Never block input.** A tap's result (cart updates, dialog opens, payment submits) happens immediately in
   state; animation decorates it. No `await` on animations before state changes. Exit animations must not
   leave invisible overlays catching taps: remove pointer events at exit start (`pointer-events: none`) and
   unmount on complete.
2. **Short.** Presses ≤ `MOTION.fast`, dialogs/list items ≈ `MOTION.base`, celebrations ≤ `MOTION.slow` (+ stagger).
   Nothing a barista waits on may exceed 300 ms.
3. **Reduced motion.** Use `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` (or check
   `prefersReducedMotion()`); with reduced motion, set end states instantly.
4. **React integration.** Use `useGSAP(() => { … }, { scope: containerRef, dependencies: [...] })`; wrap event-handler
   animations with `contextSafe`. Animate transforms/opacity (and SVG stroke via DrawSVG), never layout properties
   like width/height/top in loops. Clean up is automatic via useGSAP; don't leak tweens.
5. **"Animation lines" (SVG line drawing)** is the signature motif: draw strokes with `drawSVG` (`"0%"` → `"100%"`):
   check marks, progress lines, scanning lines, countdown rings, active-indicator underlines. Keep stroke widths
   2–4 px, round caps, colors from the palette (espresso #4A2C1A, latte #B88A5A, golden amber #F4B942, success #2F6B3F).
6. **Accessibility stays intact.** Animations never remove focus outlines, never hide content from screen readers,
   and decorative SVGs get `aria-hidden="true"`.
7. **Server/client.** GSAP only in client components ("use client"). Keep server pages as server components.

## Polish targets (and bugs found in browser QA)
- Thai initials: use `thaiInitial()` from `@/lib/thai` everywhere an avatar/tile initial is shown
  (currently shows leading vowels "เ", "โ", "แ").
- Phone numbers on the POS must be masked with `maskPhone()` (design: 081-xxx-1000).
- Swallowed taps: picking a member in the phone/scan dialog awaits a server call before closing; a tap during that gap
  lands on the backdrop and closes/eats it. Close dialogs immediately and show loading in the member panel instead.
  Backdrop dismissal must use `onClick` with a check that the press also *started* on the backdrop.
- Phone dialog close (✕) button overlaps the keypad's top-right key.
- PromptPay panel should show "สแกนจ่าย ฿X · <shop name>" (PaymentDialog gains a `shopName` prop).
- LIFF: raw English errors (e.g. "liffId is necessary for liff.init()") must become friendly Thai
  ("ร้านยังไม่ได้ตั้งค่า LINE" / "เปิดหน้านี้จากแอป LINE"); the member card header text has poor contrast over
  member-card-bg.png — add a scrim/gradient or move text to the light side.
- Admin layout renders `<main>` inside `<main>`; pages should use a `<div>`/`<section>` root.
