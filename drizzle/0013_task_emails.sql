CREATE TYPE "public"."task_email_kind" AS ENUM('assigned', 'manual', 'hour_before', 'morning', 'evening');--> statement-breakpoint
CREATE TABLE "task_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "task_email_kind" NOT NULL,
	"due_key" text DEFAULT '' NOT NULL,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" text DEFAULT 'he' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "task_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "task_emails" ADD CONSTRAINT "task_emails_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_emails" ADD CONSTRAINT "task_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_emails" ADD CONSTRAINT "task_emails_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_emails_once_idx" ON "task_emails" USING btree ("item_id","user_id","kind","due_key") WHERE "task_emails"."kind" in ('hour_before', 'morning', 'evening');--> statement-breakpoint
CREATE INDEX "task_emails_item_idx" ON "task_emails" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "task_emails_created_idx" ON "task_emails" USING btree ("created_at");