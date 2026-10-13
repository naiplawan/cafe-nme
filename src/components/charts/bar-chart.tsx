"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { formatChartValue, isEmptyChart, sanitizeData, thinLabelIndexes, type ChartDatum, type ChartFormat } from "./format";
import { CHART_COLORS, EmptyChart, HiddenData, SvgText, useMeasuredWidth } from "./shared";

type BarChartProps = { data: ChartDatum[]; format?: ChartFormat; ariaLabel: string; height?: number; highlightLast?: boolean };

export function BarChart({ data, format = "number", ariaLabel, height = 160, highlightLast = false }: BarChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(rootRef);
  const measured = width > 0;
  const safeData = sanitizeData(data);
  const empty = isEmptyChart(safeData);
  const chartHeight = Math.max(100, height);
  const plotBottom = chartHeight - 28;
  const plotTop = 10;
  const plotHeight = plotBottom - plotTop;
  const maxValue = Math.max(1, ...safeData.map(({ value }) => value));
  const step = width / Math.max(1, safeData.length);
  const barWidth = Math.max(2, Math.min(42, step * 0.64));
  const labelIndexes = new Set(thinLabelIndexes(safeData.length));
  const dataKey = JSON.stringify(data);

  useGSAP(() => {
    // Animate once the bars have their real width, otherwise the grow-in plays unseen.
    if (empty || !measured) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-chart-bar]", { scaleY: 0 }, { scaleY: 1, duration: 0.2, ease: "power2.out", stagger: Math.min(0.03, 0.08 / Math.max(1, safeData.length - 1)), transformOrigin: "center bottom" });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [dataKey, measured], revertOnUpdate: true });

  return (
    <div ref={rootRef}>
      {empty ? <div role="img" aria-label={ariaLabel} style={{ height: chartHeight }}><EmptyChart /></div> : (
        <svg role="img" aria-label={ariaLabel} className="block w-full" style={{ height: chartHeight }} viewBox={`0 0 ${Math.max(1, width)} ${chartHeight}`}>
          <title>{ariaLabel}</title>
          <line x1="0" x2={width} y1={plotBottom} y2={plotBottom} stroke="#EADBC8" />
          {safeData.map((datum, index) => {
            const x = step * index + (step - barWidth) / 2;
            const barHeight = (datum.value / maxValue) * plotHeight;
            const isHighlighted = highlightLast && index === safeData.length - 1;
            const color = isHighlighted ? "#3B2A20" : CHART_COLORS[0];
            const visibleBarHeight = Math.max(1, barHeight);
            return <g key={`${datum.label}-${index}`}>
              <rect data-chart-bar tabIndex={0} aria-label={`${datum.label}: ${formatChartValue(datum.value, format)}`} x={x} y={plotBottom - visibleBarHeight} width={barWidth} height={visibleBarHeight} rx={Math.min(5, barWidth / 2)} fill={color} style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}>
                <title>{`${datum.label}: ${formatChartValue(datum.value, format)}`}</title>
              </rect>
              {labelIndexes.has(index) && <SvgText x={x + barWidth / 2} y={chartHeight - 7}>{datum.label}</SvgText>}
            </g>;
          })}
        </svg>
      )}
      <HiddenData label={ariaLabel} data={safeData} />
    </div>
  );
}
