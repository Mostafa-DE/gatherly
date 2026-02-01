CREATE TABLE "event_session" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date_time" timestamp with time zone NOT NULL,
	"location" text,
	"max_capacity" integer NOT NULL,
	"max_waitlist" integer DEFAULT 0 NOT NULL,
	"join_mode" text DEFAULT 'open' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_member_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"join_form_schema" jsonb,
	"join_form_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participation" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'joined' NOT NULL,
	"attendance" text DEFAULT 'pending' NOT NULL,
	"payment" text DEFAULT 'unpaid' NOT NULL,
	"payment_ref" text,
	"check_in_ref" text,
	"notes" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member_profile" ADD CONSTRAINT "group_member_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member_profile" ADD CONSTRAINT "group_member_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_session_org_idx" ON "event_session" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_session_date_idx" ON "event_session" USING btree ("date_time");--> statement-breakpoint
CREATE INDEX "event_session_status_idx" ON "event_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_session_org_status_idx" ON "event_session" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_profile_org_user_idx" ON "group_member_profile" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "participation_session_idx" ON "participation" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "participation_user_idx" ON "participation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "participation_session_status_joined_idx" ON "participation" USING btree ("session_id","status","joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_active_participation" ON "participation" USING btree ("session_id","user_id") WHERE status IN ('joined', 'waitlisted');