import { z } from "zod";
export const selfOrderLineSchema = z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(99), modifierIds: z.array(z.uuid()).max(30), note: z.string().max(120).optional() }).strict();
export const selfOrderInputSchema = z.object({ clientKey: z.uuid(), statusToken: z.string().regex(/^[0-9a-f]{64}$/), mode: z.enum(["pickup", "table"]), tableLabel: z.string().max(40).nullable(), lines: z.array(selfOrderLineSchema).min(1).max(30) }).strict();
