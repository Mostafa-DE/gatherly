ALTER TABLE "participation" ADD COLUMN "attribute_overrides" jsonb;--> statement-breakpoint
ALTER TABLE "member_rank" ADD COLUMN "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;