CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"low_stock_milliunits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_unit_check" CHECK ("ingredients"."unit" in ('g','ml','unit')),
	CONSTRAINT "ingredients_low_stock_check" CHECK ("ingredients"."low_stock_milliunits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quantity_milliunits" bigint NOT NULL,
	"actor_staff_id" uuid,
	"reason" text NOT NULL,
	"request_id" uuid,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movements_kind_check" CHECK ("inventory_movements"."kind" in ('receive','waste','adjust','sale')),
	CONSTRAINT "inventory_movements_quantity_check" CHECK ("inventory_movements"."quantity_milliunits" <> 0 and abs("inventory_movements"."quantity_milliunits") <= 9007199254740991),
	CONSTRAINT "inventory_movements_reason_check" CHECK (length(trim("inventory_movements"."reason")) between 1 and 500),
	CONSTRAINT "inventory_movements_source_check" CHECK (("inventory_movements"."kind" = 'sale' and "inventory_movements"."order_id" is not null and "inventory_movements"."request_id" is null and "inventory_movements"."quantity_milliunits" < 0) or ("inventory_movements"."kind" <> 'sale' and "inventory_movements"."order_id" is null and "inventory_movements"."request_id" is not null and "inventory_movements"."actor_staff_id" is not null)),
	CONSTRAINT "inventory_movements_direction_check" CHECK (("inventory_movements"."kind" <> 'receive' or "inventory_movements"."quantity_milliunits" > 0) and ("inventory_movements"."kind" <> 'waste' or "inventory_movements"."quantity_milliunits" < 0))
);
--> statement-breakpoint
CREATE TABLE "modifier_recipe_lines" (
	"shop_id" uuid NOT NULL,
	"modifier_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_milliunits" integer NOT NULL,
	CONSTRAINT "modifier_recipe_lines_modifier_id_ingredient_id_pk" PRIMARY KEY("modifier_id","ingredient_id"),
	CONSTRAINT "modifier_recipe_lines_quantity_check" CHECK ("modifier_recipe_lines"."quantity_milliunits" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_lines" (
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_milliunits" integer NOT NULL,
	CONSTRAINT "recipe_lines_product_id_ingredient_id_pk" PRIMARY KEY("product_id","ingredient_id"),
	CONSTRAINT "recipe_lines_quantity_check" CHECK ("recipe_lines"."quantity_milliunits" > 0)
);
--> statement-breakpoint
CREATE TABLE "self_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"client_key" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mode" text NOT NULL,
	"table_label" text,
	"lines" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"total_satang" integer NOT NULL,
	"decided_by" uuid,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_orders_status_check" CHECK ("self_orders"."status" in ('pending','accepted','rejected','completed')),
	CONSTRAINT "self_orders_mode_check" CHECK ("self_orders"."mode" in ('pickup','table')),
	CONSTRAINT "self_orders_total_check" CHECK ("self_orders"."total_satang" >= 0),
	CONSTRAINT "self_orders_completion_check" CHECK (("self_orders"."status" = 'completed') = ("self_orders"."order_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_staff_id_staff_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_recipe_lines" ADD CONSTRAINT "modifier_recipe_lines_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_recipe_lines" ADD CONSTRAINT "modifier_recipe_lines_modifier_id_modifiers_id_fk" FOREIGN KEY ("modifier_id") REFERENCES "public"."modifiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_recipe_lines" ADD CONSTRAINT "modifier_recipe_lines_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_orders" ADD CONSTRAINT "self_orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_orders" ADD CONSTRAINT "self_orders_decided_by_staff_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_orders" ADD CONSTRAINT "self_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_shop_name_uidx" ON "ingredients" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_request_uidx" ON "inventory_movements" USING btree ("shop_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_sale_uidx" ON "inventory_movements" USING btree ("order_id","ingredient_id") WHERE "inventory_movements"."kind" = 'sale';--> statement-breakpoint
CREATE INDEX "inventory_movements_ingredient_idx" ON "inventory_movements" USING btree ("ingredient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "self_orders_shop_key_uidx" ON "self_orders" USING btree ("shop_id","client_key");--> statement-breakpoint
CREATE UNIQUE INDEX "self_orders_shop_token_uidx" ON "self_orders" USING btree ("shop_id","token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "self_orders_order_uidx" ON "self_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "self_orders_shop_status_created_idx" ON "self_orders" USING btree ("shop_id","status","created_at");