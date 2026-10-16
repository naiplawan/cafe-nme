"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { formatChartValue, getNiceTicks, isEmptyChart, sanitizeData, type ChartDatum, type ChartFormat } from "./format";
import { CHART_COLORS, EmptyChart, GRID_COLOR, HiddenData, SvgText, useMeasuredWidth } from "./shared";

type AreaChartProps = { data: ChartDatum[]; format?: ChartFormat; ariaLabel: string; height?: number };

export function AreaChart({ data, format = "number", ariaLabel, height = 180 }: AreaChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(rootRef);
  const measured = width > 0;
  const safeData = sanitizeData(data);
  const empty = isEmptyChart(safeData);
  const chartHeight = Math.max(120, height);
  const left = format === "baht" ? 72 : 48;
  const right = 10;
  const top = 12;
  const bottom = 24;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(1, ...safeData.map(({ value }) => value));
  const ticks = getNiceTicks(maxValue);
  const tickMax = ticks[ticks.length - 1];
  const points = safeData.map((datum, index) => ({
    x: left + (safeData.length <= 1 ? plotWidth / 2 : (plotWidth * index) / (safeData.length - 1)),
    y: top + plotHeight * (1 - datum.value / tickMax),
  }));
  const linePath = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1].x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z` : "";
  const dataKey = JSON.stringify(data);

  useGSAP(() => {
    // Wait for the measured width: drawing a path laid out at width 0 leaves a stale dash length.
    if (empty || !measured) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-area-fill]", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out" });
      gsap.fromTo("[data-area-line]", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.2, ease: "power2.out", clearProps: "strokeDasharray,strokeDashoffset" });
      gsap.fromTo("[data-area-dot]", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.14, delay: 0.14, ease: "back.out(1.7)", transformOrigin: "center center" });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [dataKey, measured], revertOnUpdate: true });

  return (
    <div ref={rootRef}>
      {empty ? <div role="img" aria-label={ariaLabel} style={{ height: chartHeight }}><EmptyChart /></div> : (
        <svg role="img" aria-label={ariaLabel} className="block w-full" style={{ height: chartHeight }} viewBox={`0 0 ${Math.max(1, width)} ${chartHeight}`}>
          <title>{ariaLabel}</title>
          {ticks.slice(1, -1).map((tick) => {
            const y = top + plotHeight * (1 - tick / tickMax);
            return <line key={tick} x1={left} x2={width - right} y1={y} y2={y} stroke={GRID_COLOR} strokeDasharray="3 4" />;
          })}
          {ticks.map((tick) => {
            const y = top + plotHeight * (1 - tick / tickMax);
            return <SvgText key={tick} x={left - 7} y={y + 3} anchor="end">{formatChartValue(tick, format)}</SvgText>;
          })}
          <path data-area-fill d={areaPath} fill={CHART_COLORS[0]} fillOpacity="0.14" />
          <path data-area-line d={linePath} fill="none" stroke={CHART_COLORS[0]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.length > 0 && <circle data-area-dot cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={CHART_COLORS[0]} stroke="white" strokeWidth="2" />}
        </svg>
      )}
      <HiddenData label={ariaLabel} data={safeData} />
    </div>
  );
}
