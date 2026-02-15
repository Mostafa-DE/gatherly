CREATE TABLE "member_rank" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ranking_definition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"current_level_id" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rank_stat_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ranking_definition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"stats" jsonb NOT NULL,
	"recorded_by" text NOT NULL,
	"notes" text,
	"correction_of_entry_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"name" text NOT NULL,
	"domain_id" text NOT NULL,
	"auto_rank_config" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_level" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ranking_definition_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_rank" ADD CONSTRAINT "member_rank_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rank" ADD CONSTRAINT "member_rank_ranking_definition_id_ranking_definition_id_fk" FOREIGN KEY ("ranking_definition_id") REFERENCES "public"."ranking_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rank" ADD CONSTRAINT "member_rank_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rank" ADD CONSTRAINT "member_rank_current_level_id_ranking_level_id_fk" FOREIGN KEY ("current_level_id") REFERENCES "public"."ranking_level"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_stat_entry" ADD CONSTRAINT "rank_stat_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_stat_entry" ADD CONSTRAINT "rank_stat_entry_ranking_definition_id_ranking_definition_id_fk" FOREIGN KEY ("ranking_definition_id") REFERENCES "public"."ranking_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_stat_entry" ADD CONSTRAINT "rank_stat_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_stat_entry" ADD CONSTRAINT "rank_stat_entry_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_stat_entry" ADD CONSTRAINT "rank_stat_entry_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_definition" ADD CONSTRAINT "ranking_definition_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_definition" ADD CONSTRAINT "ranking_definition_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_definition" ADD CONSTRAINT "ranking_definition_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_level" ADD CONSTRAINT "ranking_level_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_level" ADD CONSTRAINT "ranking_level_ranking_definition_id_ranking_definition_id_fk" FOREIGN KEY ("ranking_definition_id") REFERENCES "public"."ranking_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_rank_def_user_idx" ON "member_rank" USING btree ("ranking_definition_id","user_id");--> statement-breakpoint
CREATE INDEX "member_rank_org_user_idx" ON "member_rank" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_rank_def_level_idx" ON "member_rank" USING btree ("ranking_definition_id","current_level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rank_stat_entry_session_idempotency_idx" ON "rank_stat_entry" USING btree ("ranking_definition_id","user_id","session_id") WHERE session_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "rank_stat_entry_org_user_created_idx" ON "rank_stat_entry" USING btree ("organization_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "rank_stat_entry_def_created_idx" ON "rank_stat_entry" USING btree ("ranking_definition_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_definition_activity_idx" ON "ranking_definition" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "ranking_definition_org_idx" ON "ranking_definition" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_level_def_order_idx" ON "ranking_level" USING btree ("ranking_definition_id","order");--> statement-breakpoint
CREATE INDEX "ranking_level_org_idx" ON "ranking_level" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ranking_level_def_idx" ON "ranking_level" USING btree ("ranking_definition_id");