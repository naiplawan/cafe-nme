-- Supabase exposes public through PostgREST with the anon key, so RLS without policies denies that access. The app connects as postgres through Drizzle, which bypasses RLS.
ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pos_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."modifier_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."modifiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_modifier_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_item_modifiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."stamp_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rewards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."line_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;
