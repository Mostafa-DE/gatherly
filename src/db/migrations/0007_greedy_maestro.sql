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
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_smart_group_run_id_smart_group_run_id_fk" FOREIGN KEY ("smart_group_run_id") REFERENCES "public"."smart_group_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_user1_id_user_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_group_history" ADD CONSTRAINT "smart_group_history_user2_id_user_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "smart_group_history_activity_pair_idx" ON "smart_group_history" USING btree ("activity_id","user1_id","user2_id");--> statement-breakpoint
CREATE INDEX "smart_group_history_run_idx" ON "smart_group_history" USING btree ("smart_group_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smart_group_history_run_pair_idx" ON "smart_group_history" USING btree ("smart_group_run_id","user1_id","user2_id");