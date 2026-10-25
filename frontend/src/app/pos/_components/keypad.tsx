"use client";

import { Delete } from "lucide-react";
import { useRef } from "react";
import { cn } from "cn";
import { gsap, MOTION, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";

type KeypadProps = {
  value: string;
  decimal?: boolean;
  maxIntegerDigits?: number;
  onChange: (next: string) => void;
  maxLength: number;
  /** Label for the bottom-left key; it clears the value. */
  clearLabel?: string;
  keyClassName?: string;
  className?: string;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Large touch number pad shared by cash entry, phone search and PIN screens. */
export function Keypad({ value, onChange, maxLength, decimal = false, maxIntegerDigits = 6, clearLabel = "ล้าง", keyClassName, className }: KeypadProps) {
  const keypadRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: keypadRef });
  const animatePress = contextSafe((button: HTMLButtonElement) => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(button, { scale: 1 }, { scale: 0.96, duration: MOTION.fast / 2, yoyo: true, repeat: 1, ease: "power1.out" });
  });
  const keyClass = cn(
    "h-[72px] rounded-2xl border border-[#E4D6C6] bg-[#F5EDE3] text-[26px] font-semibold text-[#3B2A20] active:bg-[#EADBC8] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4441C]",
    keyClassName,
  );
  const press = (digit: string) => {
    const next = value + digit;
    if (next.length <= maxLength && (!decimal || new RegExp(`^\\d{0,${maxIntegerDigits}}(\\.\\d{0,2})?$`).test(next))) onChange(next);
  };

  return (
    <div ref={keypadRef} className={cn("grid grid-cols-3 gap-2.5", className)}>
      {DIGITS.map((digit) => (
        <button key={digit} type="button" className={keyClass} onClick={(event) => { press(digit); animatePress(event.currentTarget); }}>
          {digit}
        </button>
      ))}
      <button type="button" className={cn(keyClass, "text-lg")} onClick={(event) => { decimal ? press(value ? "." : "0.") : onChange(""); animatePress(event.currentTarget); }}>
        {decimal ? "." : clearLabel}
      </button>
      <button type="button" className={keyClass} onClick={(event) => { press("0"); animatePress(event.currentTarget); }}>
        0
      </button>
      <button type="button" aria-label="ลบ" className={keyClass} onClick={(event) => { onChange(value.slice(0, -1)); animatePress(event.currentTarget); }}>
        <Delete aria-hidden="true" className="mx-auto size-7" />
      </button>
    </div>
  );
}
