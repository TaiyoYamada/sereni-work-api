CREATE TYPE "public"."assignment_status" AS ENUM('DRAFT', 'PROPOSED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."optimization_run_status" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('DRAFT', 'SUBMITTED', 'REVIEWED', 'NEEDS_ACTION');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'staff', 'viewer');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "assignment_status" DEFAULT 'DRAFT' NOT NULL,
	"meeting_place" text,
	"goal" text,
	"optimization_run_id" uuid,
	"proposal_reason" text,
	"confirmed_by_staff_id" uuid,
	"confirmed_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_period_check" CHECK ("assignments"."end_date" >= "assignments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"internship_description" text,
	"required_skills" text[] DEFAULT '{}' NOT NULL,
	"supported_accommodations" text[] DEFAULT '{}' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"available_schedule" text,
	"work_hours" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"belongings" text,
	"emergency_contact" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"attitude" smallint,
	"aptitude" smallint,
	"communication" smallint,
	"accommodation_fit" smallint,
	"continuity" smallint,
	"next_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optimization_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executed_by_staff_id" uuid NOT NULL,
	"status" "optimization_run_status" DEFAULT 'PENDING' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"participant_ids" uuid[] NOT NULL,
	"company_ids" uuid[] NOT NULL,
	"solver" text NOT NULL,
	"problem_version" text NOT NULL,
	"qubo_version" text NOT NULL,
	"variable_count" integer,
	"constraint_count" integer,
	"weights" jsonb NOT NULL,
	"penalty_coefficients" jsonb,
	"random_seed" integer,
	"num_reads" integer,
	"execution_time_ms" integer,
	"energy" real,
	"violation_count" integer,
	"solver_metrics" jsonb,
	"error_message" text,
	"candidates" jsonb,
	"selected_candidate" jsonb,
	"manual_adjustments" jsonb,
	"finalized_by_staff_id" uuid,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"name" text NOT NULL,
	"kana" text,
	"email" text,
	"preferred_language" text DEFAULT 'ja' NOT NULL,
	"desired_occupations" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"strengths" text,
	"weaknesses" text,
	"accommodations" text[] DEFAULT '{}' NOT NULL,
	"commute_conditions" text,
	"needs_transport" boolean DEFAULT false NOT NULL,
	"assigned_staff_id" uuid,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "participants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "pre_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"check_date" date NOT NULL,
	"condition" smallint,
	"sleep" smallint,
	"fatigue" smallint,
	"anxiety" smallint,
	"motivation" smallint,
	"can_participate" boolean,
	"wants_consultation" boolean DEFAULT false NOT NULL,
	"accommodation_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"revised_by_staff_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"previous_content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"translated_content" jsonb NOT NULL,
	"translation_service" text NOT NULL,
	"translated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"status" "report_status" DEFAULT 'DRAFT' NOT NULL,
	"work_description" text,
	"did_well" text,
	"difficult" text,
	"enjoyed" text,
	"troubled" text,
	"satisfaction" smallint,
	"fatigue" smallint,
	"anxiety" smallint,
	"difficulty" smallint,
	"comfort" smallint,
	"instruction_clarity" smallint,
	"wants_to_continue" smallint,
	"accommodation_sufficient" boolean,
	"wants_consultation" boolean DEFAULT false NOT NULL,
	"free_text" text,
	"language" text DEFAULT 'ja' NOT NULL,
	"client_generated_id" uuid,
	"submitted_at" timestamp with time zone,
	"interview_needed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_client_generated_id_unique" UNIQUE("client_generated_id")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "staff_role" DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_confirmed_by_staff_id_staff_id_fk" FOREIGN KEY ("confirmed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_runs" ADD CONSTRAINT "optimization_runs_executed_by_staff_id_staff_id_fk" FOREIGN KEY ("executed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_runs" ADD CONSTRAINT "optimization_runs_finalized_by_staff_id_staff_id_fk" FOREIGN KEY ("finalized_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_assigned_staff_id_staff_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_checks" ADD CONSTRAINT "pre_checks_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_checks" ADD CONSTRAINT "pre_checks_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_revisions" ADD CONSTRAINT "report_revisions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_revisions" ADD CONSTRAINT "report_revisions_revised_by_staff_id_staff_id_fk" FOREIGN KEY ("revised_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_translations" ADD CONSTRAINT "report_translations_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_participant_idx" ON "assignments" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "assignments_company_idx" ON "assignments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "assignments_status_idx" ON "assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_assignment_staff_idx" ON "evaluations" USING btree ("assignment_id","staff_id");--> statement-breakpoint
CREATE INDEX "optimization_runs_status_idx" ON "optimization_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pre_checks_assignment_date_idx" ON "pre_checks" USING btree ("assignment_id","check_date");--> statement-breakpoint
CREATE UNIQUE INDEX "report_translations_report_lang_idx" ON "report_translations" USING btree ("report_id","target_language");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_assignment_date_idx" ON "reports" USING btree ("assignment_id","report_date");--> statement-breakpoint
CREATE INDEX "reports_participant_idx" ON "reports" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");