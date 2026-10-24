CREATE TABLE "shop_subscriptions" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'basic' NOT NULL,
	"trial_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"paid_until" timestamp with time zone,
	CONSTRAINT "shop_subscriptions_plan_check" CHECK ("shop_subscriptions"."plan" in ('basic','pro')),
	CONSTRAINT "shop_subscriptions_trial_check" CHECK ("shop_subscriptions"."trial_ends_at" > "shop_subscriptions"."trial_started_at")
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"paid_amount_satang" integer NOT NULL,
	"period_days" integer NOT NULL,
	"period_starts_at" timestamp with time zone NOT NULL,
	"period_ends_at" timestamp with time zone NOT NULL,
	"external_receipt_ref" text NOT NULL,
	"recorded_by_staff_id" uuid NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_plan_check" CHECK ("subscription_payments"."plan" in ('basic','pro')),
	CONSTRAINT "subscription_payments_amount_check" CHECK ("subscription_payments"."paid_amount_satang" > 0),
	CONSTRAINT "subscription_payments_period_check" CHECK ("subscription_payments"."period_days" between 1 and 366 and "subscription_payments"."period_ends_at" > "subscription_payments"."period_starts_at"),
	CONSTRAINT "subscription_payments_reference_check" CHECK (length(trim("subscription_payments"."external_receipt_ref")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "shop_subscriptions" ADD CONSTRAINT "shop_subscriptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_staff_id_staff_id_fk" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payments_request_uidx" ON "subscription_payments" USING btree ("shop_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payments_receipt_uidx" ON "subscription_payments" USING btree ("external_receipt_ref");