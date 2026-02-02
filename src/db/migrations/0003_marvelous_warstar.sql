CREATE TABLE "join_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "join_request_org_idx" ON "join_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "join_request_user_idx" ON "join_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "join_request_status_idx" ON "join_request" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "join_request_org_user_pending_idx" ON "join_request" USING btree ("organization_id","user_id") WHERE status = 'pending';