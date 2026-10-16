import { z } from "zod";

const menuModifierSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priceDeltaSatang: z.number().int(),
});

const menuGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().positive(),
  modifiers: z.array(menuModifierSchema),
});

const menuProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  categoryId: z.uuid().nullable(),
  basePriceSatang: z.number().int().nonnegative(),
  imageUrl: z.string().nullable(),
  earnsStamp: z.boolean(),
  soldOut: z.boolean(),
  groups: z.array(menuGroupSchema),
});

export const posMenuSchema = z.object({
  categories: z.array(z.object({ id: z.uuid(), name: z.string() })),
  products: z.array(menuProductSchema),
});

export type PosMenu = z.infer<typeof posMenuSchema>;
export type PosProduct = PosMenu["products"][number];
export type PosModifierGroup = PosProduct["groups"][number];
export type PosModifier = PosModifierGroup["modifiers"][number];
