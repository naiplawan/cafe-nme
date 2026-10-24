CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"opening_request_id" uuid NOT NULL,
	"opening_float_satang" integer NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"close_request_id" uuid,
	"expected_cash_satang" bigint,
	"counted_cash_satang" integer,
	"handed_to_staff_id" uuid,
	CONSTRAINT "shifts_float_nonnegative_check" CHECK ("shifts"."opening_float_satang" >= 0),
	CONSTRAINT "shifts_count_nonnegative_check" CHECK ("shifts"."counted_cash_satang" is null or "shifts"."counted_cash_satang" >= 0),
	CONSTRAINT "shifts_closed_fields_check" CHECK (("shifts"."closed_at" is null and "shifts"."closed_by" is null and "shifts"."close_request_id" is null and "shifts"."expected_cash_satang" is null and "shifts"."counted_cash_satang" is null and "shifts"."handed_to_staff_id" is null) or ("shifts"."closed_at" is not null and "shifts"."closed_by" is not null and "shifts"."close_request_id" is not null and "shifts"."expected_cash_satang" is not null and "shifts"."counted_cash_satang" is not null))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "prep_status" text DEFAULT 'received' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "prep_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_staff_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_staff_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_handed_to_staff_id_staff_id_fk" FOREIGN KEY ("handed_to_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_shop_open_uidx" ON "shifts" USING btree ("shop_id") WHERE "shifts"."closed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_shop_open_request_uidx" ON "shifts" USING btree ("shop_id","opening_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_shop_close_request_uidx" ON "shifts" USING btree ("shop_id","close_request_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;