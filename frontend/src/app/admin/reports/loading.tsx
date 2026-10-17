import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return <section role="status" aria-live="polite" aria-label="กำลังโหลดรายงาน" className="space-y-7">
    <p className="text-sm text-muted-foreground">กำลังโหลดรายงาน…</p>
    <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">
      {["sales", "orders", "cups"].map((key) => <Card key={key}>
        <CardContent className="space-y-3 p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </CardContent>
      </Card>)}
    </div>
  </section>;
}
