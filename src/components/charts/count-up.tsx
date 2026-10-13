"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { formatChartValue, type ChartFormat } from "./format";

type CountUpProps = { value: number; format?: ChartFormat; className?: string };

export function CountUp({ value, format = "number", className }: CountUpProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const safeValue = Number.isFinite(value) ? value : 0;

  useGSAP(() => {
    const element = valueRef.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: safeValue,
        duration: 0.6,
        ease: "power2.out",
        onUpdate: () => { element.textContent = formatChartValue(counter.value, format); },
        onComplete: () => { element.textContent = formatChartValue(safeValue, format); },
      });
    });
    return () => media.revert();
  }, { scope: valueRef, dependencies: [safeValue, format], revertOnUpdate: true });

  return <span ref={valueRef} className={`tabular-nums ${className ?? ""}`.trim()}>{formatChartValue(safeValue, format)}</span>;
}
