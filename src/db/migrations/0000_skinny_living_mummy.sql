CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"join_mode" text DEFAULT 'open' NOT NULL,
	"join_form_schema" jsonb,
	"join_form_version" integer DEFAULT 1 NOT NULL,
	"enabled_plugins" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
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
CREATE TABLE "event_session" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date_time" timestamp with time zone NOT NULL,
	"location" text,
	"max_capacity" integer NOT NULL,
	"max_waitlist" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2),
	"join_mode" text DEFAULT 'open' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"join_form_schema" jsonb,
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
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_category_name_unique" UNIQUE("name"),
	CONSTRAINT "interest_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "invite_link" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text,
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
CREATE TABLE "join_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
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
CREATE TABLE "member_note" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"activity_id" text,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_interest" (
	"organization_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_interest_organization_id_interest_id_pk" PRIMARY KEY("organization_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"join_form_schema" jsonb,
	"join_form_version" integer DEFAULT 1 NOT NULL,
	"currency" text,
	"enabled_plugins" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name_changed_at" timestamp with time zone,
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
	"form_answers" jsonb,
	"attribute_overrides" jsonb,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interest" (
	"user_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interest_user_id_interest_id_pk" PRIMARY KEY("user_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"timezone" text,
	"default_join_mode" text DEFAULT 'invite' NOT NULL,
	"user_slug" text NOT NULL,
	"owner_username" text NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"phone_number" text,
	"username" text,
	"intent" text,
	"country" text,
	"city" text,
	"timezone" text,
	"onboarding_completed" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_action_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"source" text NOT NULL,
	"source_event_id" text NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"transcript" text,
	"requested_payload" jsonb NOT NULL,
	"resolved_payload" jsonb,
	"execution_result" jsonb,
	"execution_error" text,
	"approved_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_bot_request_nonce" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"nonce" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_identity_link" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"telegram_user_id" text NOT NULL,
	"telegram_chat_id" text,
	"linked_by_user_id" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_record" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ranking_definition_id" text NOT NULL,
	"session_id" text,
	"match_format" text NOT NULL,
	"team1" jsonb NOT NULL,
	"team2" jsonb NOT NULL,
	"scores" jsonb NOT NULL,
	"winner" text NOT NULL,
	"derived_stats" jsonb NOT NULL,
	"recorded_by" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_rank" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ranking_definition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"current_level_id" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
CREATE TABLE "smart_group_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"name" text NOT NULL,
	"default_criteria" jsonb,
	"visible_fields" jsonb,
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
CREATE TABLE "smart_group_history" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"smart_group_run_id" text NOT NULL,
	"user1_id" text NOT NULL,
	"user2_id" text NOT NULL,
	"grouped_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"excluded_count" integer DEFAULT 0 NOT NULL,
	"generated_by" text,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_join_request" ADD CONSTRAINT "activity_join_request_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_join_request" ADD CONSTRAINT "activity_join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_join_request" ADD CONSTRAINT "activity_join_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member_profile" ADD CONSTRAINT "group_member_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member_profile" ADD CONSTRAINT "group_member_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest" ADD CONSTRAINT "interest_category_id_interest_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."interest_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_interest" ADD CONSTRAINT "organization_interest_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_interest" ADD CONSTRAINT "organization_interest_interest_id_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_interest_id_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_action_request" ADD CONSTRAINT "assistant_action_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_action_request" ADD CONSTRAINT "assistant_action_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_action_request" ADD CONSTRAINT "assistant_action_request_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_identity_link" ADD CONSTRAINT "telegram_identity_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_identity_link" ADD CONSTRAINT "telegram_identity_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_identity_link" ADD CONSTRAINT "telegram_identity_link_linked_by_user_id_user_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_ranking_definition_id_ranking_definition_id_fk" FOREIGN KEY ("ranking_definition_id") REFERENCES "public"."ranking_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "smart_group_config" ADD CONSTRAINT "smart_group_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_config" ADD CONSTRAINT "smart_group_config_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_config" ADD CONSTRAINT "smart_group_config_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_entry" ADD CONSTRAINT "smart_group_entry_smart_group_run_id_smart_group_run_id_fk" FOREIGN KEY ("smart_group_run_id") REFERENCES "public"."smart_group_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_entry" ADD CONSTRAINT "smart_group_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_smart_group_run_id_smart_group_run_id_fk" FOREIGN KEY ("smart_group_run_id") REFERENCES "public"."smart_group_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_user1_id_user_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_user2_id_user_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_proposal" ADD CONSTRAINT "smart_group_proposal_smart_group_run_id_smart_group_run_id_fk" FOREIGN KEY ("smart_group_run_id") REFERENCES "public"."smart_group_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_smart_group_config_id_smart_group_config_id_fk" FOREIGN KEY ("smart_group_config_id") REFERENCES "public"."smart_group_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_run" ADD CONSTRAINT "smart_group_run_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_org_slug_idx" ON "activity" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "activity_org_idx" ON "activity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "activity_join_request_activity_idx" ON "activity_join_request" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activity_join_request_user_idx" ON "activity_join_request" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_join_request_activity_user_pending_idx" ON "activity_join_request" USING btree ("activity_id","user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "activity_member_activity_user_idx" ON "activity_member" USING btree ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX "activity_member_activity_user_status_idx" ON "activity_member" USING btree ("activity_id","user_id","status");--> statement-breakpoint
CREATE INDEX "event_session_org_idx" ON "event_session" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_session_date_idx" ON "event_session" USING btree ("date_time");--> statement-breakpoint
CREATE INDEX "event_session_status_idx" ON "event_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_session_org_status_idx" ON "event_session" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "event_session_activity_date_idx" ON "event_session" USING btree ("activity_id","date_time");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_profile_org_user_idx" ON "group_member_profile" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interest_category_slug_idx" ON "interest" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "invite_link_org_idx" ON "invite_link" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invite_link_token_idx" ON "invite_link" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invite_link_activity_idx" ON "invite_link" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "join_request_org_idx" ON "join_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "join_request_user_idx" ON "join_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "join_request_status_idx" ON "join_request" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "join_request_org_user_pending_idx" ON "join_request" USING btree ("organization_id","user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "member_note_org_target_idx" ON "member_note" USING btree ("organization_id","target_user_id");--> statement-breakpoint
CREATE INDEX "member_note_activity_target_idx" ON "member_note" USING btree ("activity_id","target_user_id");--> statement-breakpoint
CREATE INDEX "participation_session_idx" ON "participation" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "participation_user_idx" ON "participation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "participation_session_status_joined_idx" ON "participation" USING btree ("session_id","status","joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_active_participation" ON "participation" USING btree ("session_id","user_id") WHERE status IN ('pending', 'joined', 'waitlisted');--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_action_request_idempotency_idx" ON "assistant_action_request" USING btree ("organization_id","source","source_event_id");--> statement-breakpoint
CREATE INDEX "assistant_action_request_org_status_idx" ON "assistant_action_request" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_bot_request_nonce_sender_nonce_idx" ON "assistant_bot_request_nonce" USING btree ("sender_id","nonce");--> statement-breakpoint
CREATE INDEX "assistant_bot_request_nonce_expires_at_idx" ON "assistant_bot_request_nonce" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_identity_link_org_tg_user_idx" ON "telegram_identity_link" USING btree ("organization_id","telegram_user_id");--> statement-breakpoint
CREATE INDEX "telegram_identity_link_org_user_idx" ON "telegram_identity_link" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "match_record_def_created_idx" ON "match_record" USING btree ("ranking_definition_id","created_at");--> statement-breakpoint
CREATE INDEX "match_record_session_idx" ON "match_record" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "match_record_org_idx" ON "match_record" USING btree ("organization_id");--> statement-breakpoint
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
CREATE INDEX "ranking_level_def_idx" ON "ranking_level" USING btree ("ranking_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_config_activity_idx" ON "smart_group_config" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "smart_group_config_org_idx" ON "smart_group_config" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_entry_run_user_idx" ON "smart_group_entry" USING btree ("smart_group_run_id","user_id");--> statement-breakpoint
CREATE INDEX "smart_group_entry_run_idx" ON "smart_group_entry" USING btree ("smart_group_run_id");--> statement-breakpoint
CREATE INDEX "smart_group_history_activity_pair_idx" ON "smart_group_history" USING btree ("activity_id","user1_id","user2_id");--> statement-breakpoint
CREATE INDEX "smart_group_history_run_idx" ON "smart_group_history" USING btree ("smart_group_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_history_run_pair_idx" ON "smart_group_history" USING btree ("smart_group_run_id","user1_id","user2_id");--> statement-breakpoint
CREATE INDEX "smart_group_proposal_run_idx" ON "smart_group_proposal" USING btree ("smart_group_run_id","group_index");--> statement-breakpoint
CREATE INDEX "smart_group_run_config_idx" ON "smart_group_run" USING btree ("smart_group_config_id","created_at");--> statement-breakpoint
CREATE INDEX "smart_group_run_session_idx" ON "smart_group_run" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "smart_group_run_org_idx" ON "smart_group_run" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_run_confirmed_session_idx" ON "smart_group_run" USING btree ("smart_group_config_id","scope","session_id") WHERE status = 'confirmed' AND session_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_run_confirmed_activity_idx" ON "smart_group_run" USING btree ("smart_group_config_id","scope") WHERE status = 'confirmed' AND session_id IS NULL;