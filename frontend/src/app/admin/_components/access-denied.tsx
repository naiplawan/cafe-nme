import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AdminAccessDenied({ message }: { message: string }) {
  return <Card className="max-w-xl border-amber-500/30">
    <CardContent className="flex gap-4 p-5 sm:p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-800" aria-hidden="true"><ShieldAlert className="size-5" /></span>
      <div className="space-y-1">
        <h1 className="font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    </CardContent>
  </Card>;
}
