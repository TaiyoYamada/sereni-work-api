ALTER TABLE "participants" ADD COLUMN "login_id" text;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_login_id_unique" UNIQUE("login_id");