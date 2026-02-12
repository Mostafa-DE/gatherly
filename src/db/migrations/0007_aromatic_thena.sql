ALTER TABLE "event_session" ADD COLUMN "join_form_schema" jsonb;--> statement-breakpoint
ALTER TABLE "participation" ADD COLUMN "form_answers" jsonb;