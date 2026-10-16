"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { sanitizeValues } from "./format";
import { CHART_COLORS, HiddenData, useMeasuredWidth } from "./shared";

type SparklineProps = { values: number[]; ariaLabel: string; width?: number; height?: number };

export function Sparkline({ values, ariaLabel, width: preferredWidth = 120, height = 32 }: SparklineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(rootRef);
  const measured = width > 0;
  const safeValues = sanitizeValues(values);
  const empty = safeValues.length === 0 || safeValues.every((value) => value === 0);
  const chartWidth = width || Math.max(1, preferredWidth);
  const chartHeight = Math.max(16, height);
  const inset = 3;
  const maxValue = Math.max(1, ...safeValues);
  const points = safeValues.map((value, index) => ({
    x: inset + (safeValues.length <= 1 ? (chartWidth - inset * 2) / 2 : ((chartWidth - inset * 2) * index) / (safeValues.length - 1)),
    y: inset + (chartHeight - inset * 2) * (1 - value / maxValue),
  }));
  const path = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const dataKey = JSON.stringify(values);

  useGSAP(() => {
    // Wait for the measured width: drawing a path laid out at width 0 leaves a stale dash length.
    if (empty || !measured) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-sparkline]", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.28, ease: "power2.out", clearProps: "strokeDasharray,strokeDashoffset" });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [dataKey, measured], revertOnUpdate: true });

  const chartData = safeValues.map((value, index) => ({ label: String(index + 1), value }));
  return (
    <div ref={rootRef} className="inline-block align-middle" style={{ width: preferredWidth, height: chartHeight }}>
      {empty ? <div role="img" aria-label={ariaLabel} className="flex h-full items-center justify-center text-[9px] leading-tight text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</div> : (
        <svg role="img" aria-label={ariaLabel} className="block h-full w-full" viewBox={`0 0 ${Math.max(1, chartWidth)} ${chartHeight}`}>
          <title>{ariaLabel}</title>
          <path data-sparkline d={path} fill="none" stroke={CHART_COLORS[0]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <HiddenData label={ariaLabel} data={chartData} />
    </div>
  );
}
