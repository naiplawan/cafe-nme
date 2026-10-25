-- Preserve snapshots/holds on ingredient deletion, but allow a whole shop and
-- its dependent orders to be deleted in one transaction regardless of cascade order.
ALTER TABLE "modifier_recipe_lines" ALTER CONSTRAINT "modifier_recipe_lines_replaces_ingredient_id_ingredients_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "order_item_recipes" ALTER CONSTRAINT "order_item_recipes_ingredient_id_ingredients_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "order_stock_holds" ALTER CONSTRAINT "order_stock_holds_ingredient_id_ingredients_id_fk" DEFERRABLE INITIALLY DEFERRED;
