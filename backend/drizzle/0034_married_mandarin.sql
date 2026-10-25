CREATE TABLE "order_item_recipes" (
	"order_item_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_milliunits" integer NOT NULL,
	CONSTRAINT "order_item_recipes_order_item_id_ingredient_id_pk" PRIMARY KEY("order_item_id","ingredient_id"),
	CONSTRAINT "order_item_recipes_quantity_check" CHECK ("order_item_recipes"."quantity_milliunits" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_stock_holds" (
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_milliunits" bigint NOT NULL,
	CONSTRAINT "order_stock_holds_order_id_ingredient_id_pk" PRIMARY KEY("order_id","ingredient_id"),
	CONSTRAINT "order_stock_holds_quantity_check" CHECK ("order_stock_holds"."quantity_milliunits" > 0)
);
--> statement-breakpoint
CREATE TABLE "remakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remakes_qty_check" CHECK ("remakes"."qty" between 1 and 99),
	CONSTRAINT "remakes_reason_check" CHECK (length(trim("remakes"."reason")) between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_kind_check";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_source_check";--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "remake_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "recipe_snapshot_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "stock_consumption" text DEFAULT 'payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD CONSTRAINT "order_item_recipes_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD CONSTRAINT "order_item_recipes_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_holds" ADD CONSTRAINT "order_stock_holds_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_holds" ADD CONSTRAINT "order_stock_holds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_holds" ADD CONSTRAINT "order_stock_holds_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remakes" ADD CONSTRAINT "remakes_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remakes" ADD CONSTRAINT "remakes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remakes" ADD CONSTRAINT "remakes_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remakes" ADD CONSTRAINT "remakes_actor_staff_id_staff_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_stock_holds_ingredient_idx" ON "order_stock_holds" USING btree ("shop_id","ingredient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "remakes_request_uidx" ON "remakes" USING btree ("shop_id","request_id");--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_remake_id_remakes_id_fk" FOREIGN KEY ("remake_id") REFERENCES "public"."remakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_kind_check" CHECK ("inventory_movements"."kind" in ('receive','waste','adjust','sale','remake'));--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_source_check" CHECK (("inventory_movements"."kind" = 'sale' and "inventory_movements"."order_id" is not null and "inventory_movements"."request_id" is null and "inventory_movements"."quantity_milliunits" < 0) or ("inventory_movements"."kind" = 'remake' and "inventory_movements"."remake_id" is not null and "inventory_movements"."order_id" is not null and "inventory_movements"."request_id" is null and "inventory_movements"."actor_staff_id" is not null and "inventory_movements"."quantity_milliunits" < 0) or ("inventory_movements"."kind" not in ('sale','remake') and "inventory_movements"."order_id" is null and "inventory_movements"."request_id" is not null and "inventory_movements"."actor_staff_id" is not null));--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_stock_consumption_check" CHECK ("shops"."stock_consumption" in ('payment','preparation'));