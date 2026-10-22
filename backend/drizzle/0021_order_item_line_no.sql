ALTER TABLE "order_items" ADD COLUMN "line_no" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "order_id" ORDER BY "id") - 1 AS "line_no"
  FROM "order_items"
)
UPDATE "order_items" AS item SET "line_no" = ranked."line_no"
FROM ranked WHERE item."id" = ranked."id";
