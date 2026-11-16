CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"status" "list_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_one_active_per_list" ON "rounds" USING btree ("list_id") WHERE "rounds"."status" = 'active';--> statement-breakpoint
CREATE INDEX "rounds_list_idx" ON "rounds" USING btree ("list_id","created_at");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;