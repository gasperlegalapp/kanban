CREATE TYPE "public"."audit_kind" AS ENUM('case_created', 'case_updated', 'stage_change', 'stage_skip', 'lane_change', 'case_closed', 'case_reopened', 'case_archived', 'task_created', 'task_status', 'task_updated', 'task_deleted', 'event_created', 'event_updated', 'event_deleted', 'comment', 'attachment', 'template_applied', 'import');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."deadline_anchor" AS ENUM('appointment_date', 'date_of_death', 'case_opened');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('hearing', 'deadline');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('pending', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_lane" AS ENUM('core', 'assets', 'litigation', 'social');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'requested', 'in_progress', 'waiting', 'review', 'blocked', 'done');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('attorney', 'staff');--> statement-breakpoint
CREATE TYPE "public"."will_status" AS ENUM('testate', 'intestate', 'unknown');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"task_id" uuid,
	"file_name" text NOT NULL,
	"content_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"task_id" uuid,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"kind" "audit_kind" NOT NULL,
	"from_value" text,
	"to_value" text,
	"reason" text,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text,
	"color" text DEFAULT '#64748b' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" text NOT NULL,
	"stage_id" uuid NOT NULL,
	"lane_id" uuid,
	"case_type_id" uuid,
	"title" text NOT NULL,
	"client_name" text,
	"case_number" text,
	"county" text,
	"court" text,
	"fiduciary" text,
	"will_status" "will_status" DEFAULT 'unknown' NOT NULL,
	"owner_id" uuid,
	"actionstep_url" text,
	"appointment_date" date,
	"date_of_death" date,
	"description" text DEFAULT '' NOT NULL,
	"status" "case_status" DEFAULT 'active' NOT NULL,
	"stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"closed_at" timestamp with time zone,
	"external_ref" jsonb
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"assignee_id" uuid,
	"due_date" date,
	"done_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"task_id" uuid,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"kind" "event_kind" DEFAULT 'deadline' NOT NULL,
	"anchor" "deadline_anchor" NOT NULL,
	"offset_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" "event_kind" NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"time" text,
	"status" "event_status" DEFAULT 'pending' NOT NULL,
	"rule_key" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"external_ref" jsonb
);
--> statement-breakpoint
CREATE TABLE "lanes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_archive" boolean DEFAULT false NOT NULL,
	"stuck_days" integer,
	"critical_days" integer,
	"policy" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "task_status" DEFAULT 'requested' NOT NULL,
	"lane" "task_lane" DEFAULT 'core' NOT NULL,
	"assignee_id" uuid,
	"due_date" date,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"template_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"external_ref" jsonb
);
--> statement-breakpoint
CREATE TABLE "template_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"apply_on_create" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"lane" "task_lane" DEFAULT 'core' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"due_anchor" "deadline_anchor",
	"due_offset_days" integer
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_types" ADD CONSTRAINT "case_types_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_case_type_id_case_types_id_fk" FOREIGN KEY ("case_type_id") REFERENCES "public"."case_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_rules" ADD CONSTRAINT "deadline_rules_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_set_id_template_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."template_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_case_idx" ON "attachments" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "attachments_task_idx" ON "attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "audit_case_idx" ON "audit_log" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_types_board_key_idx" ON "case_types" USING btree ("board_id","key");--> statement-breakpoint
CREATE INDEX "cases_board_stage_idx" ON "cases" USING btree ("board_id","stage_id");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checklist_task_idx" ON "checklist_items" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "comments_case_idx" ON "comments" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "comments_task_idx" ON "comments" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deadline_rules_board_key_idx" ON "deadline_rules" USING btree ("board_id","key");--> statement-breakpoint
CREATE INDEX "events_case_idx" ON "events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "lanes_board_key_idx" ON "lanes" USING btree ("board_id","key");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_idx" ON "notifications" USING btree ("user_id","dedupe_key") WHERE "notifications"."dedupe_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_idx" ON "profiles" USING btree (lower("email")) WHERE "profiles"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_auth_user_idx" ON "profiles" USING btree ("auth_user_id") WHERE "profiles"."auth_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stages_board_key_idx" ON "stages" USING btree ("board_id","key");--> statement-breakpoint
CREATE INDEX "tasks_case_idx" ON "tasks" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "template_sets_board_key_idx" ON "template_sets" USING btree ("board_id","key");--> statement-breakpoint
CREATE INDEX "template_tasks_set_idx" ON "template_tasks" USING btree ("set_id");