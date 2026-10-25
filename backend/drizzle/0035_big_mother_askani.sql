ALTER TABLE "modifier_recipe_lines" DROP CONSTRAINT "modifier_recipe_lines_replaces_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "order_item_recipes" DROP CONSTRAINT "order_item_recipes_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "order_stock_holds" DROP CONSTRAINT "order_stock_holds_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "modifier_recipe_lines" ADD CONSTRAINT "modifier_recipe_lines_replaces_ingredient_id_ingredients_id_fk" FOREIGN KEY ("replaces_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD CONSTRAINT "order_item_recipes_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_holds" ADD CONSTRAINT "order_stock_holds_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;