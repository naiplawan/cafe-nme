"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { MenuActionState } from "./actions";
import { moveItem } from "./menu-steps";

type Item = { id: string; name: string };

/** Drag to reorder on desktop; the arrow buttons cover touch screens and keyboards. */
export function SortableList({ label, items, onChange, renderItem }: {
  label: string;
  items: Item[];
  onChange: (items: Item[]) => void;
  renderItem?: (item: Item) => ReactNode;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <ol aria-label={label} className="divide-y rounded-lg border">
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDragging(index)}
          onDragEnd={() => setDragging(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragging !== null) onChange(moveItem(items, dragging, index));
            setDragging(null);
          }}
          className={`flex min-h-12 items-center gap-2 bg-card px-2 text-sm ${dragging === index ? "opacity-50" : ""}`}
        >
          <GripVertical aria-hidden="true" className="size-4 shrink-0 cursor-grab text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{renderItem ? renderItem(item) : item.name}</span>
          <Button type="button" variant="ghost" size="icon" aria-label={`ย้าย ${item.name} ขึ้น`} disabled={index === 0} onClick={() => onChange(moveItem(items, index, index - 1))}><ChevronUp aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`ย้าย ${item.name} ลง`} disabled={index === items.length - 1} onClick={() => onChange(moveItem(items, index, index + 1))}><ChevronDown aria-hidden="true" /></Button>
        </li>
      ))}
    </ol>
  );
}

/** Save and cancel controls shared by the category and product reorder modes. */
export function ReorderActions({ ids, save, onDone }: {
  ids: string[];
  save: (ids: string[]) => Promise<MenuActionState>;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {message ? <p role="alert" className="mr-auto text-sm text-destructive">{message}</p> : null}
      <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>ยกเลิก</Button>
      <Button type="button" disabled={pending} onClick={() => startTransition(async () => {
        const result = await save(ids);
        if (result.success) onDone();
        else setMessage(result.message);
      })}>{pending ? "กำลังบันทึก…" : "บันทึกลำดับ"}</Button>
    </div>
  );
}
