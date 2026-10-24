CREATE TABLE "provider_payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"self_order_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"amount_satang" integer NOT NULL,
	"currency" text DEFAULT 'thb' NOT NULL,
	"test_mode" boolean NOT NULL,
	"checkout_input" jsonb NOT NULL,
	"provider_account_id" text,
	"provider_charge_id" text,
	"status" text DEFAULT 'creating' NOT NULL,
	"qr_image_url" text,
	"discrepancy_code" text,
	"verified_at" timestamp with time zone,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_intents_amount_check" CHECK ("provider_payment_intents"."amount_satang" between 2000 and 15000000 and "provider_payment_intents"."currency" = 'thb'),
	CONSTRAINT "provider_intents_status_check" CHECK ("provider_payment_intents"."status" in ('creating','uncertain','pending','verified','paid_unfulfilled','discrepancy','completed','failed','expired')),
	CONSTRAINT "provider_intents_completed_check" CHECK ("provider_payment_intents"."status" <> 'completed' or ("provider_payment_intents"."order_id" is not null and "provider_payment_intents"."verified_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "provider_webhook_events" (
	"shop_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"intent_id" uuid,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_webhook_events_shop_id_event_id_pk" PRIMARY KEY("shop_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "provider_payment_intents" ADD CONSTRAINT "provider_payment_intents_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payment_intents" ADD CONSTRAINT "provider_payment_intents_self_order_id_self_orders_id_fk" FOREIGN KEY ("self_order_id") REFERENCES "public"."self_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payment_intents" ADD CONSTRAINT "provider_payment_intents_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payment_intents" ADD CONSTRAINT "provider_payment_intents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_intent_id_provider_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."provider_payment_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_intents_draft_uidx" ON "provider_payment_intents" USING btree ("self_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_intents_charge_uidx" ON "provider_payment_intents" USING btree ("provider_account_id","provider_charge_id");