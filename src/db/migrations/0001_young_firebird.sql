CREATE TABLE "invite_link" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_link_org_idx" ON "invite_link" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invite_link_token_idx" ON "invite_link" USING btree ("token");