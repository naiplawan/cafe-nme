function pointOnCircle(cx: number, cy: number, radius: number, angle: number): readonly [number, number] {
  const radians = (angle * Math.PI) / 180;
  const rounded = (value: number) => {
    const result = Number(value.toFixed(3));
    return Object.is(result, -0) ? 0 : result;
  };
  return [rounded(cx + radius * Math.cos(radians)), rounded(cy + radius * Math.sin(radians))];
}

export function createDonutSectorPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const [x1, y1] = pointOnCircle(cx, cy, outer, start);
  const [x2, y2] = pointOnCircle(cx, cy, outer, end);
  const [x3, y3] = pointOnCircle(cx, cy, inner, end);
  const [x4, y4] = pointOnCircle(cx, cy, inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function createDonutArcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const [x1, y1] = pointOnCircle(cx, cy, radius, start);
  const [x2, y2] = pointOnCircle(cx, cy, radius, end);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}
