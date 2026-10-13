ALTER TABLE "pos_devices" ALTER COLUMN "device_token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "pos_devices" ADD COLUMN "pairing_code_hash" text;--> statement-breakpoint
ALTER TABLE "pos_devices" ADD COLUMN "pairing_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_voided_by_staff_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;