"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { type MenuStep, type ProductFilters, menuHref, parseProductFilters } from "./menu-steps";

export type MenuStepItem = { step: MenuStep; label: string; count: number };

export function MenuStepNav({ steps, current, filters }: { steps: MenuStepItem[]; current: MenuStep; filters: ProductFilters }) {
  const router = useRouter();
  return (
    <nav aria-label="ขั้นตอนจัดการเมนู" className="overflow-x-auto">
      <ol className="flex min-w-max gap-6 border-b">
        {steps.map(({ step, label, count }) => {
          const active = step === current;
          return (
            <li key={step}>
              <Link
                href={menuHref(step, filters)}
                aria-current={active ? "step" : undefined}
                // List filters live in the URL via replaceState; read them at click time.
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  router.push(menuHref(step, parseProductFilters(new URLSearchParams(window.location.search))), { scroll: false });
                }}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 border-b-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
