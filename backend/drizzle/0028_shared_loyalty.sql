CREATE TABLE "loyalty_group_shops" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_group_shops" ADD CONSTRAINT "loyalty_group_shops_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_group_shops" ADD CONSTRAINT "loyalty_group_shops_group_id_loyalty_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."loyalty_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_groups" ADD CONSTRAINT "loyalty_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loyalty_group_shops_group_idx" ON "loyalty_group_shops" USING btree ("group_id");