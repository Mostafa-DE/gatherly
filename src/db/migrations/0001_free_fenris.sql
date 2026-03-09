CREATE TABLE "tournament" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'activity_members' NOT NULL,
	"participant_type" text DEFAULT 'individual' NOT NULL,
	"seeding_method" text DEFAULT 'manual' NOT NULL,
	"entry_fee_amount" numeric(10, 2),
	"currency" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"user_id" text,
	"team_id" text,
	"status" text DEFAULT 'registered' NOT NULL,
	"seed" integer,
	"final_placement" integer,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_entry_xor_user_team" CHECK ((
        ("tournament_entry"."user_id" IS NOT NULL AND "tournament_entry"."team_id" IS NULL)
        OR ("tournament_entry"."user_id" IS NULL AND "tournament_entry"."team_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "tournament_group" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"name" text NOT NULL,
	"group_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_match" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"round_id" text NOT NULL,
	"match_number" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scores" jsonb,
	"winner_entry_id" text,
	"scheduled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_match_edge" (
	"id" text PRIMARY KEY NOT NULL,
	"from_match_id" text NOT NULL,
	"to_match_id" text NOT NULL,
	"outcome_type" text NOT NULL,
	"outcome_rank" integer,
	"to_slot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_match_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"slot" integer NOT NULL,
	"result" text,
	"score" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_round" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"group_id" text,
	"round_number" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"stage_type" text NOT NULL,
	"stage_order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_standing" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"group_id" text,
	"entry_id" text NOT NULL,
	"rank" integer,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"tiebreakers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_team" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"name" text NOT NULL,
	"captain_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_team_id_tournament_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."tournament_team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group" ADD CONSTRAINT "tournament_group_stage_id_tournament_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."tournament_stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_round_id_tournament_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."tournament_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match_edge" ADD CONSTRAINT "tournament_match_edge_from_match_id_tournament_match_id_fk" FOREIGN KEY ("from_match_id") REFERENCES "public"."tournament_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match_edge" ADD CONSTRAINT "tournament_match_edge_to_match_id_tournament_match_id_fk" FOREIGN KEY ("to_match_id") REFERENCES "public"."tournament_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match_entry" ADD CONSTRAINT "tournament_match_entry_match_id_tournament_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match_entry" ADD CONSTRAINT "tournament_match_entry_entry_id_tournament_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round" ADD CONSTRAINT "tournament_round_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round" ADD CONSTRAINT "tournament_round_stage_id_tournament_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."tournament_stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_round" ADD CONSTRAINT "tournament_round_group_id_tournament_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_stage" ADD CONSTRAINT "tournament_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_stage" ADD CONSTRAINT "tournament_stage_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standing" ADD CONSTRAINT "tournament_standing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standing" ADD CONSTRAINT "tournament_standing_stage_id_tournament_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."tournament_stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standing" ADD CONSTRAINT "tournament_standing_group_id_tournament_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standing" ADD CONSTRAINT "tournament_standing_entry_id_tournament_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team" ADD CONSTRAINT "tournament_team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team" ADD CONSTRAINT "tournament_team_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team" ADD CONSTRAINT "tournament_team_captain_user_id_user_id_fk" FOREIGN KEY ("captain_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team_member" ADD CONSTRAINT "tournament_team_member_team_id_tournament_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."tournament_team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team_member" ADD CONSTRAINT "tournament_team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_activity_slug_idx" ON "tournament" USING btree ("activity_id","slug");--> statement-breakpoint
CREATE INDEX "tournament_activity_status_idx" ON "tournament" USING btree ("activity_id","status","starts_at");--> statement-breakpoint
CREATE INDEX "tournament_org_status_idx" ON "tournament" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_user_idx" ON "tournament_entry" USING btree ("tournament_id","user_id") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_team_idx" ON "tournament_entry" USING btree ("tournament_id","team_id") WHERE team_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_seed_idx" ON "tournament_entry" USING btree ("tournament_id","seed") WHERE seed IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tournament_entry_tournament_status_idx" ON "tournament_entry" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "tournament_entry_org_idx" ON "tournament_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_group_stage_order_idx" ON "tournament_group" USING btree ("stage_id","group_order");--> statement-breakpoint
CREATE INDEX "tournament_group_stage_idx" ON "tournament_group" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "tournament_match_tournament_status_idx" ON "tournament_match" USING btree ("tournament_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "tournament_match_round_idx" ON "tournament_match" USING btree ("round_id","match_number");--> statement-breakpoint
CREATE INDEX "tournament_match_org_idx" ON "tournament_match" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_edge_to_slot_idx" ON "tournament_match_edge" USING btree ("to_match_id","to_slot");--> statement-breakpoint
CREATE INDEX "tournament_match_edge_from_idx" ON "tournament_match_edge" USING btree ("from_match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_edge_from_outcome_idx" ON "tournament_match_edge" USING btree ("from_match_id","outcome_type","outcome_rank") WHERE outcome_rank IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_edge_from_outcome_no_rank_idx" ON "tournament_match_edge" USING btree ("from_match_id","outcome_type") WHERE outcome_rank IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_entry_slot_idx" ON "tournament_match_entry" USING btree ("match_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_entry_entry_idx" ON "tournament_match_entry" USING btree ("match_id","entry_id");--> statement-breakpoint
CREATE INDEX "tournament_match_entry_match_idx" ON "tournament_match_entry" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_round_stage_no_group_idx" ON "tournament_round" USING btree ("stage_id","round_number") WHERE group_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_round_stage_group_idx" ON "tournament_round" USING btree ("stage_id","group_id","round_number") WHERE group_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tournament_round_stage_idx" ON "tournament_round" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "tournament_round_org_idx" ON "tournament_round" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_stage_order_idx" ON "tournament_stage" USING btree ("tournament_id","stage_order");--> statement-breakpoint
CREATE INDEX "tournament_stage_tournament_idx" ON "tournament_stage" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "tournament_stage_org_idx" ON "tournament_stage" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_standing_stage_no_group_idx" ON "tournament_standing" USING btree ("stage_id","entry_id") WHERE group_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_standing_stage_group_idx" ON "tournament_standing" USING btree ("stage_id","group_id","entry_id") WHERE group_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tournament_standing_stage_idx" ON "tournament_standing" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "tournament_standing_org_idx" ON "tournament_standing" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tournament_team_tournament_idx" ON "tournament_team" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "tournament_team_org_idx" ON "tournament_team" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_team_member_team_user_idx" ON "tournament_team_member" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "tournament_team_member_team_idx" ON "tournament_team_member" USING btree ("team_id");