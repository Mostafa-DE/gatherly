CREATE TABLE "smart_group_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"name" text NOT NULL,
	"default_criteria" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_group_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"smart_group_run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"data_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_group_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"smart_group_run_id" text NOT NULL,
	"group_index" integer NOT NULL,
	"group_name" text NOT NULL,
	"member_ids" jsonb NOT NULL,
	"modified_member_ids" jsonb,
	"status" text DEFAULT 'proposed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_group_run" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"smart_group_config_id" text NOT NULL,
	"session_id" text,
	"scope" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"criteria_snapshot" jsonb NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"group_count" integer DEFAULT 0 NOT NULL,
	"generated_by" text,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_group_config" ADD CONSTRAINT "smart_group_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_config" ADD CONSTRAINT "smart_group_config_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_config" ADD CONSTRAINT "smart_group_config_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_entry" ADD CONSTRAINT "smart_group_entry_smart_group_run_id_smart_group_run_id_fk" FOREIGN KEY ("smart_group_run_id") REFERENCES "public"."smart_group_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_entry" ADD CONSTRAINT "smart_group_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_proposal" ADD CONSTRAINT "smart_group_proposal_smart_group_run_id_smart_group_run_id_fk" FOREIGN KEY ("smart_group_run_id") REFERENCES "public"."smart_group_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_smart_group_config_id_smart_group_config_id_fk" FOREIGN KEY ("smart_group_config_id") REFERENCES "public"."smart_group_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_config_activity_idx" ON "smart_group_config" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "smart_group_config_org_idx" ON "smart_group_config" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_entry_run_user_idx" ON "smart_group_entry" USING btree ("smart_group_run_id","user_id");--> statement-breakpoint
CREATE INDEX "smart_group_entry_run_idx" ON "smart_group_entry" USING btree ("smart_group_run_id");--> statement-breakpoint
CREATE INDEX "smart_group_proposal_run_idx" ON "smart_group_proposal" USING btree ("smart_group_run_id","group_index");--> statement-breakpoint
CREATE INDEX "smart_group_run_config_idx" ON "smart_group_run" USING btree ("smart_group_config_id","created_at");--> statement-breakpoint
CREATE INDEX "smart_group_run_session_idx" ON "smart_group_run" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "smart_group_run_org_idx" ON "smart_group_run" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_run_confirmed_session_idx" ON "smart_group_run" USING btree ("smart_group_config_id","scope","session_id") WHERE status = 'confirmed' AND session_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_run_confirmed_activity_idx" ON "smart_group_run" USING btree ("smart_group_config_id","scope") WHERE status = 'confirmed' AND session_id IS NULL;