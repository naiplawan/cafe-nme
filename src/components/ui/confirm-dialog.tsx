"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Submitter = HTMLButtonElement | HTMLInputElement | null;
type ConfirmSubmitProps = Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action?: React.FormHTMLAttributes<HTMLFormElement>["action"];
  message: string | ((form: HTMLFormElement, submitter: Submitter) => string);
  title?: string;
  confirmLabel: string | ((submitter: Submitter) => string);
  destructive?: boolean | ((submitter: Submitter) => boolean);
  shouldConfirm?: (form: HTMLFormElement, submitter: Submitter) => boolean;
};

export function ConfirmSubmit({
  action,
  children,
  message,
  title = "ยืนยันรายการ",
  confirmLabel,
  destructive = false,
  shouldConfirm,
  ...formProps
}: ConfirmSubmitProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitterRef = useRef<Submitter>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState({ message: "", label: "ยืนยัน", destructive: false });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) {
      allowSubmitRef.current = false;
      return;
    }

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as Submitter;
    if (shouldConfirm && !shouldConfirm(form, submitter)) return;

    event.preventDefault();
    submitterRef.current = submitter;
    setConfirmation({
      message: typeof message === "function" ? message(form, submitter) : message,
      label: typeof confirmLabel === "function" ? confirmLabel(submitter) : confirmLabel,
      destructive: typeof destructive === "function" ? destructive(submitter) : destructive,
    });
    setOpen(true);
  }

  function confirm() {
    const form = formRef.current;
    if (!form) return;
    const submitter = submitterRef.current;
    allowSubmitRef.current = true;
    setOpen(false);
    if (submitter && submitter.isConnected) form.requestSubmit(submitter);
    else form.requestSubmit();
  }

  return (
    <>
      <form {...formProps} ref={formRef} action={action} onSubmit={handleSubmit}>
        {children}
      </form>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/45 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border bg-card p-5 text-card-foreground shadow-xl outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="space-y-2">
              <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
              <AlertDialog.Description className="text-sm leading-relaxed text-muted-foreground">{confirmation.message}</AlertDialog.Description>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialog.Close render={<Button type="button" variant="outline" />}>ยกเลิก</AlertDialog.Close>
              <Button type="button" variant={confirmation.destructive ? "destructive" : "default"} onClick={confirm}>{confirmation.label}</Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
