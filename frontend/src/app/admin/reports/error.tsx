"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section role="alert" className="mx-auto max-w-xl py-8">
    <Card>
      <CardHeader><CardTitle>โหลดรายงานไม่สำเร็จ</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">ตรวจสอบการเชื่อมต่อ แล้วลองโหลดรายงานอีกครั้ง</p>
        <Button type="button" onClick={retry}>ลองใหม่</Button>
      </CardContent>
    </Card>
  </section>;
}
