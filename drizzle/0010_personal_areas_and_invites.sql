CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."list_visibility" AS ENUM('place', 'selected');--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid,
	"list_ids" uuid[],
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_members" (
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_members_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "visibility" "list_visibility" DEFAULT 'place' NOT NULL;--> statement-breakpoint
ALTER TABLE "place_members" ADD COLUMN "all_lists" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "personal_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_members" ADD CONSTRAINT "list_members_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_members" ADD CONSTRAINT "list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_email_idx" ON "invites" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "invites_place_idx" ON "invites" USING btree ("place_id","status");--> statement-breakpoint
CREATE INDEX "list_members_user_idx" ON "list_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_personal_owner_id_users_id_fk" FOREIGN KEY ("personal_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_personal_owner_id_unique" UNIQUE("personal_owner_id");