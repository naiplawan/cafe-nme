import { z } from "zod";
import { parseBahtToSatang } from "@/lib/money";

const name = z.string().trim().min(1, "กรุณากรอกชื่อ").max(80);

const baht = (opts: { allowNegative: boolean }) =>
  z.string().transform((value, ctx) => {
    const satang = parseBahtToSatang(value);
    if (satang === null || (!opts.allowNegative && satang < 0)) {
      ctx.addIssue({ code: "custom", message: "ราคาไม่ถูกต้อง" });
      return z.NEVER;
    }
    return satang;
  });

// HTML checkboxes send "on" when checked and nothing when unchecked.
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const categorySchema = z.object({ name });

export const productSchema = z.object({
  name,
  price: baht({ allowNegative: false }),
  categoryId: optionalUuid,
  imageUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  earnsStamp: checkbox,
  isActive: checkbox,
});

export const modifierGroupSchema = z
  .object({
    name,
    minSelect: z.coerce.number().int().min(0).max(20),
    maxSelect: z.coerce.number().int().min(1).max(20),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    message: "ขั้นต่ำต้องไม่มากกว่าสูงสุด",
    path: ["minSelect"],
  });

export const modifierSchema = z.object({
  groupId: z.uuid(),
  name,
  priceDelta: baht({ allowNegative: true }),
});
