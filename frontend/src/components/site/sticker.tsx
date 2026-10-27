import type { ReactNode } from "react";

const tones = { caramel: "bg-caramel text-cream", amber: "bg-amber text-ink" } as const;
const chipTones = { blush: "bg-blush text-espresso", amber: "bg-amber text-ink" } as const;

// Big tilted label under a headline, as in the reference sites.
export function TiltLabel({ tone = "caramel", className = "", children }: { tone?: keyof typeof tones; className?: string; children: ReactNode }) {
  return <span className={`font-display-condensed inline-block -rotate-2 px-4 py-1.5 text-[clamp(22px,3vw,36px)] ${tones[tone]} ${className}`}>{children}</span>;
}

// Small rotated chip for eyebrows.
export function Sticker({ tone = "blush", children }: { tone?: keyof typeof chipTones; children: ReactNode }) {
  return <span className={`inline-flex -rotate-2 rounded-full px-3.5 py-1 text-[13px] font-bold ${chipTones[tone]}`}>{children}</span>;
}
