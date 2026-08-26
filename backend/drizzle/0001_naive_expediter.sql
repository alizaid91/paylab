CREATE TYPE "public"."payment_method" AS ENUM('upi', 'card', 'net_banking');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_method" "payment_method" DEFAULT 'card' NOT NULL;