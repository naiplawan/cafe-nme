CREATE TABLE "shop_brands" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"accent" text,
	"logo" "bytea",
	"logo_mime" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_brands" ADD CONSTRAINT "shop_brands_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."shop_brands" ENABLE ROW LEVEL SECURITY;