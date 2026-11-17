ALTER TYPE "public"."list_type" ADD VALUE 'checklist';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "due_time" time;