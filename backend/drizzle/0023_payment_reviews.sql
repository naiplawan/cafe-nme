CREATE TABLE "payment_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"observed_satang" integer NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reviews_observed_nonnegative_check" CHECK ("payment_reviews"."observed_satang" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_reviewed_by_staff_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reviews_shop_request_uidx" ON "payment_reviews" USING btree ("shop_id","request_id");--> statement-breakpoint
CREATE INDEX "payment_reviews_payment_idx" ON "payment_reviews" USING btree ("payment_id","created_at");