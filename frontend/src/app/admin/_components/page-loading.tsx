import { Card, CardContent } from "@/components/ui/card";

export function AdminPageLoading({ label }: { label: string }) {
  return <section role="status" aria-live="polite" aria-label={`กำลังโหลด${label}`} className="space-y-6">
    <p className="text-sm text-muted-foreground">กำลังโหลด{label}…</p>
    <div aria-hidden="true" className="space-y-3">
      <Card><CardContent className="space-y-3 p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </CardContent></Card>
      <Card><CardContent className="h-28 animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none" /></Card>
    </div>
  </section>;
}
