"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "คัดลอก" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <span className="inline-flex items-center gap-2">
    <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={`${label}: ${value}`}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "คัดลอกแล้ว" : label}
    </Button>
    <span className="sr-only" role="status" aria-live="polite">{copied ? "คัดลอกแล้ว" : ""}</span>
  </span>;
}
