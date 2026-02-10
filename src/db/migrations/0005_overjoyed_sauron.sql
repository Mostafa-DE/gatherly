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
CREATE TABLE "organization_interest" (
	"organization_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_interest_organization_id_interest_id_pk" PRIMARY KEY("organization_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE "user_interest" (
	"user_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interest_user_id_interest_id_pk" PRIMARY KEY("user_id","interest_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "interest" ADD CONSTRAINT "interest_category_id_interest_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."interest_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_interest" ADD CONSTRAINT "organization_interest_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_interest" ADD CONSTRAINT "organization_interest_interest_id_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_interest_id_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interest_category_slug_idx" ON "interest" USING btree ("category_id","slug");