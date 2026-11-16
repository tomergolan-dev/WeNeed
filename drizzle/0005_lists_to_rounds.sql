-- Until now each row in "lists" was one round of the place's single list of
-- that type. Every row becomes a round (keeping its id), the oldest row of each
-- place and type becomes the named list, and the other rows are removed.
INSERT INTO "rounds" ("id", "list_id", "status", "created_at", "completed_at", "completed_by")
SELECT l."id", c."id", l."status", l."created_at", l."completed_at", l."completed_by"
FROM "lists" l
JOIN (
  SELECT DISTINCT ON ("place_id", "type") "id", "place_id", "type"
  FROM "lists"
  ORDER BY "place_id", "type", "created_at"
) c ON c."place_id" = l."place_id" AND c."type" = l."type";--> statement-breakpoint
UPDATE "items" SET "round_id" = "list_id";--> statement-breakpoint
-- Point items at the surviving list first, so removing the other rows doesn't cascade to them.
UPDATE "items" i SET "list_id" = r."list_id" FROM "rounds" r WHERE r."id" = i."round_id";--> statement-breakpoint
DELETE FROM "lists" WHERE "id" NOT IN (SELECT "list_id" FROM "rounds");--> statement-breakpoint
UPDATE "lists" SET "name" = CASE "type" WHEN 'shopping' THEN 'קניות' ELSE 'מטלות' END;--> statement-breakpoint
-- Every list always has an active round.
INSERT INTO "rounds" ("list_id")
SELECT l."id" FROM "lists" l
WHERE NOT EXISTS (SELECT 1 FROM "rounds" r WHERE r."list_id" = l."id" AND r."status" = 'active');
