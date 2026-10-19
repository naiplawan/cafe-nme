ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_selection_bounds_check" CHECK ("modifier_groups"."min_select" >= 0 and "modifier_groups"."max_select" >= "modifier_groups"."min_select");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_qty_bounds_check" CHECK ("order_items"."qty" between 1 and 99);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_nonnegative_check" CHECK ("order_items"."unit_price_satang" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_base_price_nonnegative_check" CHECK ("products"."base_price_satang" >= 0);--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_stamp_goal_positive_check" CHECK ("shops"."stamp_goal" > 0);