ALTER TABLE "products" ADD COLUMN "sold_out_on" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "auto_clear_sold_out" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Products already sold out count as sold out today, so the first menu read after deploy keeps them sold out.
UPDATE "products" p SET "sold_out_on" = to_char(now() at time zone s.timezone, 'YYYY-MM-DD') FROM "shops" s WHERE p.shop_id = s.id AND p.sold_out;
