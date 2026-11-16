ALTER TABLE "items" DROP CONSTRAINT "items_assignee_id_members_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_done_by_members_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_added_by_members_id_fk";--> statement-breakpoint
ALTER TABLE "lists" DROP CONSTRAINT "lists_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "lists" DROP CONSTRAINT "lists_completed_by_members_id_fk";--> statement-breakpoint
DROP INDEX "lists_household_idx";--> statement-breakpoint
DROP INDEX "lists_one_active_per_type";--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "place_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lists_place_idx" ON "lists" USING btree ("place_id","type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lists_one_active_per_type" ON "lists" USING btree ("place_id","type") WHERE "lists"."status" = 'active';--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN "household_id";--> statement-breakpoint
DROP TABLE "households" CASCADE;--> statement-breakpoint
DROP TABLE "login_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "members" CASCADE;
