import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  section,
  action,
}: {
  title: string;
  description?: string;
  section?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {section && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary/70">{section}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
