ALTER TABLE "notifications" ADD COLUMN "kind" text DEFAULT 'reminder' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "waiting_on" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "follow_up_date" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "review_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template_sets" ADD COLUMN "trigger_stage_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_trigger_stage_id_stages_id_fk" FOREIGN KEY ("trigger_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_follow_up_idx" ON "tasks" USING btree ("follow_up_date");