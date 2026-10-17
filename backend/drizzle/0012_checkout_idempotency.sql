ALTER TABLE "orders" ADD COLUMN "checkout_key" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_fingerprint" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_result" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_shop_checkout_key_uidx" ON "orders" USING btree ("shop_id","checkout_key");