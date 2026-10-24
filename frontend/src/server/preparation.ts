import "server-only";
import { z } from "zod";
import { internalApiFetch, readInternalJson } from "@/server/internal-api";

const preparationStatus = z.enum(["received", "preparing", "ready"]);
const updateSchema = z.object({ id: z.uuid(), status: preparationStatus, updatedAt: z.string().nullable() });
const rowSchema = updateSchema.extend({
  dailyNo: z.number().int().positive(),
  items: z.array(z.object({ id: z.uuid(), name: z.string(), qty: z.number().int().positive(), note: z.string().nullable(), modifiers: z.array(z.string()) })),
});
export type PreparationRow = z.infer<typeof rowSchema>;
export type PreparationStatus = z.infer<typeof preparationStatus>;

export async function listPreparation(shopId: string, actorStaffId: string): Promise<PreparationRow[]> {
  const response = await internalApiFetch(`/v1/shops/${shopId}/preparation?${new URLSearchParams({ actorStaffId })}`);
  if (!response.ok) { throw new Error("Unable to load preparation queue"); }
  return z.array(rowSchema).parse(await readInternalJson(response));
}

export async function transitionPreparation(shopId: string, actorStaffId: string, orderId: string, expected: PreparationStatus, desired: PreparationStatus) {
  const response = await internalApiFetch(`/v1/shops/${shopId}/preparation/${orderId}`, {
    method: "POST", body: JSON.stringify({ actorStaffId, expected, desired }),
  });
  if (!response.ok) { throw new Error("Preparation may have changed; refresh before retrying"); }
  return updateSchema.parse(await readInternalJson(response));
}
