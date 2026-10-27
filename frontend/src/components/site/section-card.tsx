import type { ReactNode } from "react";

const tones = {
  caramel: "bg-caramel text-cream",
  espresso: "bg-espresso text-cream",
  butter: "bg-butter text-espresso",
  cream: "bg-cream text-ink",
  blush: "bg-blush text-espresso",
} as const;

export type SectionTone = keyof typeof tones;

export function SectionCard({ tone, id, className = "", children }: { tone: SectionTone; id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`mx-3 scroll-mt-4 overflow-hidden rounded-section md:mx-5 ${tones[tone]} ${className}`}>
      {children}
    </section>
  );
}
