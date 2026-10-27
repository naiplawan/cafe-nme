import { z } from "zod";

// Mirrors the POST /v1/contact-messages contract (docs/CONTRACTS.md): keep the two in step.
export const CONTACT_TOPICS = [
  { value: "demo", label: "ขอดูตัวอย่างการใช้งาน" },
  { value: "pricing", label: "สอบถามราคา" },
  { value: "support", label: "ขอความช่วยเหลือ" },
  { value: "other", label: "เรื่องอื่น ๆ" },
] as const;

export const contactSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง").max(254, "อีเมลยาวเกินไป"),
  phone: z.string().regex(/^[0-9+\- ]{9,20}$/, "กรุณากรอกเบอร์โทรให้ถูกต้อง").optional(),
  shopName: z.string().max(120, "ชื่อร้านยาวเกิน 120 ตัวอักษร").optional(),
  topic: z.enum(["demo", "pricing", "support", "other"], "กรุณาเลือกหัวข้อ"),
  message: z.string().min(10, "ข้อความต้องมีอย่างน้อย 10 ตัวอักษร").max(2000, "ข้อความยาวเกิน 2,000 ตัวอักษร"),
  consent: z.literal(true, "กรุณายินยอมให้ติดต่อกลับ"),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const CONTACT_MESSAGES = {
  success: "ได้รับข้อความแล้ว ทีมงานจะติดต่อกลับทางอีเมล",
  invalid: "กรุณาตรวจสอบข้อมูลอีกครั้ง",
  rateLimited: "ส่งบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
  failed: "ส่งไม่สำเร็จ กรุณาลองใหม่",
} as const;
