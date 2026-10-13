"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { formatChartValue, isEmptyChart, sanitizeData, type ChartDatum, type ChartFormat } from "./format";
import { createDonutArcPath, createDonutSectorPath } from "./geometry";
import { CHART_COLORS, EmptyChart, HiddenData } from "./shared";

type DonutDatum = ChartDatum & { color?: string };
type DonutChartProps = { data: DonutDatum[]; format?: ChartFormat; ariaLabel: string; size?: number; centerLabel?: string; centerValue?: string };

export function DonutChart({ data, format = "number", ariaLabel, size = 160, centerLabel, centerValue }: DonutChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const safeData = sanitizeData(data);
  const empty = isEmptyChart(safeData);
  const chartSize = Math.max(100, size);
  const center = chartSize / 2;
  const outer = chartSize * 0.46;
  const inner = chartSize * 0.29;
  const midRadius = (outer + inner) / 2;
  const total = safeData.reduce((sum, datum) => sum + datum.value, 0) || 1;
  const segments = safeData.reduce<{ items: (typeof safeData[number] & { color: string; path: string; arc: string; percent: number })[]; cursor: number }>((accumulator, datum, index) => {
    const sweep = (datum.value / total) * 360;
    const start = accumulator.cursor + 1;
    const end = accumulator.cursor + Math.max(1.1, sweep - 1);
    const segment = {
      ...datum,
      color: (data[index].color && /^#[\da-f]{6}$/i.test(data[index].color) ? data[index].color : CHART_COLORS[index % CHART_COLORS.length]),
      path: datum.value > 0 ? createDonutSectorPath(center, center, outer, inner, start, end) : "",
      arc: datum.value > 0 ? createDonutArcPath(center, center, midRadius, start, end) : "",
      percent: (datum.value / total) * 100,
    };
    return { items: [...accumulator.items, segment], cursor: accumulator.cursor + sweep };
  }, { items: [], cursor: -90 }).items;
  const dataKey = JSON.stringify(data);

  useGSAP(() => {
    if (empty) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-donut-line]", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.2, ease: "power2.out", stagger: Math.min(0.08, 0.08 / Math.max(1, segments.length - 1)) });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [dataKey], revertOnUpdate: true });

  return (
    <div ref={rootRef} className="@container">
      {empty ? <div role="img" aria-label={ariaLabel} style={{ minHeight: chartSize }}><EmptyChart /></div> : (
        // Legend goes beside the donut only when the card itself is wide enough (not the viewport).
        <div className="flex flex-col items-center gap-4 @md:flex-row @md:items-center">
          <svg role="img" aria-label={ariaLabel} className="shrink-0" width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
            <title>{ariaLabel}</title>
            {segments.map((segment, index) => <g key={`${segment.label}-${index}`}>
              <path d={segment.path} fill={segment.color}>
                <title>{`${segment.label}: ${formatChartValue(segment.value, format)} (${formatChartValue(segment.percent, "percent")})`}</title>
              </path>
              {segment.value > 0 && <path data-donut-line d={segment.arc} fill="none" stroke={segment.color} strokeWidth="3" strokeLinecap="round" />}
            </g>)}
            {(centerLabel || centerValue) && <text x={center} y={center} textAnchor="middle" className="fill-[#3B2A20]">
              {centerLabel && <tspan x={center} dy={centerValue ? "-0.25em" : "0.35em"} className="text-[10px]">{centerLabel}</tspan>}
              {centerValue && <tspan x={center} dy={centerLabel ? "1.5em" : "0.35em"} className="text-sm font-semibold tabular-nums">{centerValue}</tspan>}
            </text>}
          </svg>
          <ul className="grid w-full gap-2 text-sm @md:min-w-0">
            {segments.map((segment, index) => <li key={`${segment.label}-${index}`} className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="min-w-0 flex-1 truncate">{segment.label}</span>
              <span className="shrink-0 text-right tabular-nums">{formatChartValue(segment.value, format)} <span className="text-muted-foreground">{formatChartValue(segment.percent, "percent")}</span></span>
            </li>)}
          </ul>
        </div>
      )}
      <HiddenData label={ariaLabel} data={safeData} />
    </div>
  );
}
