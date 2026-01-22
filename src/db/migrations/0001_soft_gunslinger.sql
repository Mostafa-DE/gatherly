ALTER TABLE "organization" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "default_join_mode" text DEFAULT 'invite' NOT NULL;