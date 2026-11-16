-- Moves the single-household data into places and users.
-- Members keep their ids as user ids, so every existing reference stays valid.
INSERT INTO "places" ("id", "name", "created_at")
SELECT "id", "name", "created_at" FROM "households";--> statement-breakpoint
INSERT INTO "users" ("id", "name", "phone", "pending_action", "created_at")
SELECT "id", "name", "phone", "pending_action", "created_at" FROM "members";--> statement-breakpoint
INSERT INTO "place_members" ("place_id", "user_id", "role", "joined_at")
SELECT "household_id", "id", 'owner', "created_at" FROM "members";--> statement-breakpoint
INSERT INTO "allowed_phones" ("phone", "note")
SELECT "phone", "name" FROM "members" ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "lists" SET "place_id" = "household_id";
