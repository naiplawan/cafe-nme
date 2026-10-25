CREATE TABLE "promptpay_stock_hold_items" (
	"shop_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_milliunits" bigint NOT NULL,
	CONSTRAINT "promptpay_stock_hold_items_shop_id_request_id_ingredient_id_pk" PRIMARY KEY("shop_id","request_id","ingredient_id"),
	CONSTRAINT "promptpay_stock_hold_items_quantity_check" CHECK ("promptpay_stock_hold_items"."quantity_milliunits" > 0)
);
--> statement-breakpoint
CREATE TABLE "promptpay_stock_holds" (
	"shop_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promptpay_stock_holds_shop_id_request_id_pk" PRIMARY KEY("shop_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "promptpay_stock_hold_items" ADD CONSTRAINT "promptpay_stock_hold_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptpay_stock_hold_items" ADD CONSTRAINT "promptpay_stock_hold_items_shop_id_request_id_promptpay_stock_holds_shop_id_request_id_fk" FOREIGN KEY ("shop_id","request_id") REFERENCES "public"."promptpay_stock_holds"("shop_id","request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptpay_stock_holds" ADD CONSTRAINT "promptpay_stock_holds_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promptpay_stock_holds" ADD CONSTRAINT "promptpay_stock_holds_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promptpay_stock_holds_expiry_idx" ON "promptpay_stock_holds" USING btree ("expires_at");