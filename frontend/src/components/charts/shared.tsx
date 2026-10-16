"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ChartDatum } from "./format";

export const CHART_COLORS = ["#B4441C", "#C69C72", "#3B2A20", "#2F6B3F", "#D9653B"] as const;
export const GRID_COLOR = "#EADBC8";

export function useMeasuredWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(0, element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export function HiddenData({ label, data }: { label: string; data: ChartDatum[] }) {
  return (
    <table className="sr-only">
      <caption>{label}</caption>
      <thead><tr><th scope="col">รายการ</th><th scope="col">ค่า</th></tr></thead>
      <tbody>{data.map((datum) => <tr key={datum.label}><th scope="row">{datum.label}</th><td>{datum.value}</td></tr>)}</tbody>
    </table>
  );
}

export function EmptyChart() {
  return <p className="flex h-full min-h-20 items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</p>;
}

export function SvgText({ x, y, children, anchor = "middle" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return <text x={x} y={y} textAnchor={anchor} className="fill-[#6B5A4D] text-[10px] tabular-nums">{children}</text>;
}
