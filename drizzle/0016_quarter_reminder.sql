ALTER TYPE "public"."task_email_kind" ADD VALUE 'quarter_before';--> statement-breakpoint
DROP INDEX "task_emails_once_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "task_emails_once_idx" ON "task_emails" USING btree ("item_id","user_id","kind","due_key") WHERE "task_emails"."kind" not in ('assigned', 'manual');