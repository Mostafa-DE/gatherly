-- Add phone_number column as nullable first to support existing users
ALTER TABLE "user" ADD COLUMN "phone_number" text;--> statement-breakpoint
-- Add unique constraint
ALTER TABLE "user" ADD CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number");