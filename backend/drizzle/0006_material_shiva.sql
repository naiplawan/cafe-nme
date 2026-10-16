CREATE TABLE "rate_limit_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_attempts_window_idx" ON "rate_limit_attempts" USING btree ("window_started_at");
--> statement-breakpoint
ALTER TABLE "public"."rate_limit_attempts" ENABLE ROW LEVEL SECURITY;
