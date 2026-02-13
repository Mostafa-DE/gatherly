CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"join_mode" text DEFAULT 'open' NOT NULL,
	"join_form_schema" jsonb,
	"join_form_version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_join_request" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"form_answers" jsonb,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_member" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_session" ADD COLUMN "activity_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_link" ADD COLUMN "activity_id" text;--> statement-breakpoint
ALTER TABLE "member_note" ADD COLUMN "activity_id" text;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_join_request" ADD CONSTRAINT "activity_join_request_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_join_request" ADD CONSTRAINT "activity_join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_join_request" ADD CONSTRAINT "activity_join_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_org_slug_idx" ON "activity" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "activity_org_idx" ON "activity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "activity_join_request_activity_idx" ON "activity_join_request" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activity_join_request_user_idx" ON "activity_join_request" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_join_request_activity_user_pending_idx" ON "activity_join_request" USING btree ("activity_id","user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "activity_member_activity_user_idx" ON "activity_member" USING btree ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX "activity_member_activity_user_status_idx" ON "activity_member" USING btree ("activity_id","user_id","status");--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_session_activity_date_idx" ON "event_session" USING btree ("activity_id","date_time");--> statement-breakpoint
CREATE INDEX "invite_link_activity_idx" ON "invite_link" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "member_note_activity_target_idx" ON "member_note" USING btree ("activity_id","target_user_id");