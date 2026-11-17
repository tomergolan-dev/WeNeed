CREATE TABLE "demo_ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_ai_requests_visitor_idx" ON "demo_ai_requests" USING btree ("visitor","created_at");--> statement-breakpoint
CREATE INDEX "demo_ai_requests_created_idx" ON "demo_ai_requests" USING btree ("created_at");