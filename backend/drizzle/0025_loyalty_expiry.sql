ALTER TABLE "rewards" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stamp_ledger" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stamp_ledger" ADD COLUMN "source_entry_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "stamp_ledger_expire_source_uidx" ON "stamp_ledger" USING btree ("source_entry_id") WHERE "stamp_ledger"."reason" = 'expire';--> statement-breakpoint
UPDATE stamp_ledger l SET expires_at = ((CURRENT_TIMESTAMP AT TIME ZONE s.timezone) + make_interval(months => s.stamp_expiry_months)) AT TIME ZONE s.timezone
FROM shops s WHERE l.shop_id=s.id AND l.delta>0 AND l.expires_at IS NULL;
--> statement-breakpoint
UPDATE rewards r SET expires_at = ((CURRENT_TIMESTAMP AT TIME ZONE s.timezone) + make_interval(months => s.stamp_expiry_months)) AT TIME ZONE s.timezone
FROM shops s WHERE r.shop_id=s.id AND r.expires_at IS NULL;
