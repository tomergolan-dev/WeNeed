ALTER TABLE "items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing items keep the order they were added in.
UPDATE "items" SET "position" = ranked.n
FROM (
  SELECT id, row_number() OVER (PARTITION BY round_id ORDER BY created_at) AS n FROM "items"
) AS ranked
WHERE "items".id = ranked.id;
