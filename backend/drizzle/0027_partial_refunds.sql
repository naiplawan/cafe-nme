CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"amount_satang" integer NOT NULL,
	"lines" jsonb NOT NULL,
	"reason" text NOT NULL,
	"approved_by" uuid NOT NULL,
	"paid_by" uuid,
	"paid_at" timestamp with time zone,
	"payout_method" "payment_method",
	"payout_reference" text,
	"cash_shift_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_nonnegative_check" CHECK ("refunds"."amount_satang" >= 0),
	CONSTRAINT "refunds_reason_check" CHECK (length(trim("refunds"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "paid_satang" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "stamps_earned" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "inventory_deducted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_staff_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paid_by_staff_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_cash_shift_id_shifts_id_fk" FOREIGN KEY ("cash_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_shop_request_uidx" ON "refunds" USING btree ("shop_id","request_id");