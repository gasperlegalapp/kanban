CREATE TYPE "public"."template_repeat" AS ENUM('once', 'every_time');--> statement-breakpoint
CREATE TABLE "template_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_sets" ADD COLUMN "repeat" "template_repeat" DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD COLUMN "due_from_creation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD COLUMN "assign_to_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template_runs" ADD CONSTRAINT "template_runs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_runs" ADD CONSTRAINT "template_runs_set_id_template_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."template_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_runs_case_set_idx" ON "template_runs" USING btree ("case_id","set_id");--> statement-breakpoint
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: a case that already has tasks from a set counts as having had that set once.
INSERT INTO "template_runs" ("case_id", "set_id", "created_at")
SELECT t."case_id", s."id", min(t."created_at")
FROM "tasks" t
JOIN "template_sets" s ON t."template_key" LIKE s."key" || ':%'
GROUP BY t."case_id", s."id";
