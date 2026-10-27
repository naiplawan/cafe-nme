"use client";

import { useActionState, useId } from "react";
import { Field } from "@/components/site/field";
import { PillButton } from "@/components/site/pill";
import { CONTACT_TOPICS } from "@/lib/contact-schema";
import { type ContactState, sendContactMessage } from "./actions";

const initial: ContactState = { status: "idle", message: "", fieldErrors: {}, values: {} };
const selectClass = "min-h-12 w-full rounded-full border-[1.5px] border-line bg-white px-5 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso aria-[invalid=true]:border-danger";

export function ContactForm() {
  const id = useId();
  const [state, action, pending] = useActionState(sendContactMessage, initial);
  const { fieldErrors, values } = state;

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-card bg-butter p-6 text-lg font-medium leading-[1.7] text-espresso">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-5">
      {state.status === "error" && (
        <p role="alert" className="rounded-card border-[1.5px] border-danger bg-white px-5 py-3 font-medium text-danger">
          {state.message}
        </p>
      )}
      <Field label="ชื่อ" name="name" required autoComplete="name" maxLength={100} placeholder="ชื่อของคุณ" defaultValue={values.name} error={fieldErrors.name} />
      <Field label="อีเมล" name="email" type="email" required autoComplete="email" maxLength={254} placeholder="name@example.com" defaultValue={values.email} error={fieldErrors.email} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="เบอร์โทร (ไม่บังคับ)" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} placeholder="081 234 5678" defaultValue={values.phone} error={fieldErrors.phone} />
        <Field label="ชื่อร้าน (ไม่บังคับ)" name="shopName" autoComplete="organization" maxLength={120} placeholder="ชื่อร้านของคุณ" defaultValue={values.shopName} error={fieldErrors.shopName} />
      </div>
      <div className="grid gap-2">
        <label htmlFor={`${id}-topic`} className="text-[14px] font-bold text-espresso">
          หัวข้อ<span aria-hidden className="ml-1 text-caramel">*</span>
        </label>
        <select
          id={`${id}-topic`}
          name="topic"
          required
          aria-required
          aria-invalid={fieldErrors.topic ? true : undefined}
          aria-describedby={fieldErrors.topic ? `${id}-topic-error` : undefined}
          defaultValue={values.topic ?? ""}
          className={selectClass}
        >
          <option value="" disabled>เลือกหัวข้อ</option>
          {CONTACT_TOPICS.map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
        </select>
        {fieldErrors.topic ? <p id={`${id}-topic-error`} className="text-sm font-medium text-danger">{fieldErrors.topic}</p> : null}
      </div>
      <Field label="ข้อความ" name="message" multiline required maxLength={2000} placeholder="เล่าให้เราฟังว่าต้องการอะไร" defaultValue={values.message} error={fieldErrors.message} />

      <div className="grid gap-2">
        <label htmlFor={`${id}-consent`} className="flex min-h-11 items-start gap-3 leading-[1.6]">
          <input
            id={`${id}-consent`}
            name="consent"
            type="checkbox"
            defaultChecked={values.consent === "on"}
            aria-required
            aria-invalid={fieldErrors.consent ? true : undefined}
            aria-describedby={fieldErrors.consent ? `${id}-consent-error` : undefined}
            className="mt-1 size-6 shrink-0 accent-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso"
          />
          <span>ฉันยินยอมให้ YELO Coffee ใช้ข้อมูลนี้เพื่อติดต่อกลับเรื่องที่ฉันสอบถาม</span>
        </label>
        {fieldErrors.consent ? <p id={`${id}-consent-error`} className="text-sm font-medium text-danger">{fieldErrors.consent}</p> : null}
      </div>

      {/* Honeypot: hidden from sight, keyboard and screen readers. A bot that fills it is dropped by the action. */}
      <div aria-hidden inert className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <PillButton type="submit" disabled={pending}>{pending ? "กำลังส่ง…" : "ส่งข้อความ"}</PillButton>
      </div>
    </form>
  );
}
