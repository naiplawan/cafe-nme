import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  amber: { shell: "bg-amber text-ink hover:bg-amber/85", arrow: "bg-ink text-amber" },
  espresso: { shell: "bg-espresso text-cream hover:bg-roast", arrow: "bg-cream text-espresso" },
  outline: { shell: "border-[1.5px] border-espresso text-espresso hover:bg-butter", arrow: "bg-espresso text-cream" },
} as const;

export type PillVariant = keyof typeof variants;

const shell = "group inline-flex min-h-12 items-center gap-3 rounded-full whitespace-nowrap py-2 pl-6 pr-2 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso disabled:cursor-not-allowed disabled:opacity-60";

function PillContent({ variant, children }: { variant: PillVariant; children: ReactNode }) {
  return (
    <>
      {children}
      <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full transition-transform group-hover:translate-x-0.5 ${variants[variant].arrow}`}>
        <ArrowRight size={16} strokeWidth={2.5} />
      </span>
    </>
  );
}

export function PillLink({ href, variant = "amber", children }: { href: string; variant?: PillVariant; children: ReactNode }) {
  return (
    <Link href={href} className={`${shell} ${variants[variant].shell}`}>
      <PillContent variant={variant}>{children}</PillContent>
    </Link>
  );
}

export function PillButton({ variant = "amber", children, ...props }: { variant?: PillVariant } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button {...props} className={`${shell} ${variants[variant].shell}`}>
      <PillContent variant={variant}>{children}</PillContent>
    </button>
  );
}
