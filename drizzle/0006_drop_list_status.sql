ALTER TABLE "items" DROP CONSTRAINT "items_list_id_lists_id_fk";
--> statement-breakpoint
ALTER TABLE "lists" DROP CONSTRAINT "lists_completed_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "items_list_idx";--> statement-breakpoint
DROP INDEX "lists_one_active_per_type";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "round_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "items_round_idx" ON "items" USING btree ("round_id");--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "list_id";--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN "completed_by";