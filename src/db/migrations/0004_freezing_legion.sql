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
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_ranking_definition_id_ranking_definition_id_fk" FOREIGN KEY ("ranking_definition_id") REFERENCES "public"."ranking_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_session_id_event_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_record" ADD CONSTRAINT "match_record_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_record_def_created_idx" ON "match_record" USING btree ("ranking_definition_id","created_at");--> statement-breakpoint
CREATE INDEX "match_record_session_idx" ON "match_record" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "match_record_org_idx" ON "match_record" USING btree ("organization_id");