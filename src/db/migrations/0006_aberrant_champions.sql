ALTER TABLE "user" ALTER COLUMN "phone_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_session" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "currency" text;