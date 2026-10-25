ALTER TABLE "ingredients" ADD COLUMN "average_cost_per_milliunit" numeric(30, 12);--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "cost_satang" bigint;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD COLUMN "unit_cost_satang" numeric(30, 12);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "reward_discount_satang" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cost_satang" bigint;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_satang" numeric(30, 12);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "prepared_qty" integer;