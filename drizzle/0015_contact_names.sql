CREATE TABLE "contact_names" (
	"owner_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "contact_names_owner_id_user_id_pk" PRIMARY KEY("owner_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "contact_names" ADD CONSTRAINT "contact_names_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_names" ADD CONSTRAINT "contact_names_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;