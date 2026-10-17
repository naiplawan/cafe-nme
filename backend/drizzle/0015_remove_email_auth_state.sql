DROP TABLE IF EXISTS "email_verification_tokens";
--> statement-breakpoint
DROP TABLE IF EXISTS "password_reset_tokens";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified_at";
