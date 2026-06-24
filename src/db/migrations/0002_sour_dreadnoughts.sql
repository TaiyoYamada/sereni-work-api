CREATE TYPE "public"."support_stage" AS ENUM('ASSESSMENT', 'TRAINING', 'INTERNSHIP', 'JOB_HUNTING', 'RETENTION');--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "stage" "support_stage" DEFAULT 'ASSESSMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "service_start_date" date;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "recipient_cert_number" text;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "recipient_cert_expiry" date;