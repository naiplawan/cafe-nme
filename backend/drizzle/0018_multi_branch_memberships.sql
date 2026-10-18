ALTER TABLE "staff" DROP CONSTRAINT "staff_auth_user_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_shop_auth_user_uidx" ON "staff" USING btree ("shop_id", "auth_user_id");
