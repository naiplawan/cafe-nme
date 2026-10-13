"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { formatChartValue, isEmptyChart, sanitizeData, type ChartDatum, type ChartFormat } from "./format";
import { CHART_COLORS, EmptyChart, HiddenData } from "./shared";

type HBarListProps = { data: ChartDatum[]; format?: ChartFormat; ariaLabel: string; limit?: number };

export function HBarList({ data, format = "number", ariaLabel, limit = 5 }: HBarListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const safeData = sanitizeData(data);
  const empty = isEmptyChart(safeData);
  const rankedData = safeData.slice(0, Math.max(0, Math.floor(limit)));
  const maxValue = Math.max(1, ...rankedData.map(({ value }) => value));
  const dataKey = JSON.stringify(data);

  useGSAP(() => {
    if (empty) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      // Grow each bar to its own share of the max (a fixed scaleX: 1 would make every bar full width).
      gsap.fromTo("[data-hbar-fill]", { scaleX: 0 }, { scaleX: (_index: number, element: HTMLElement) => Number(element.dataset.ratio ?? 1), duration: 0.2, ease: "power2.out", stagger: Math.min(0.04, 0.08 / Math.max(1, rankedData.length - 1)), transformOrigin: "left center" });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [dataKey, limit], revertOnUpdate: true });

  return (
    <div ref={rootRef}>
      {empty ? <div role="img" aria-label={ariaLabel} className="min-h-24"><EmptyChart /></div> : (
        <ol role="img" aria-label={ariaLabel} className="space-y-3">
          {rankedData.map((datum, index) => <li key={`${datum.label}-${index}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2">
            <span className="text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-sm">{datum.label}</p>
              <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-[#EADBC8]">
                <div data-hbar-fill data-ratio={datum.value / maxValue} className="h-full w-full origin-left rounded-full" style={{ backgroundColor: CHART_COLORS[0], transform: `scaleX(${datum.value / maxValue})` }} />
              </div>
            </div>
            <span className="text-right text-sm font-medium tabular-nums">{formatChartValue(datum.value, format)}</span>
          </li>)}
        </ol>
      )}
      <HiddenData label={ariaLabel} data={safeData} />
    </div>
  );
}
