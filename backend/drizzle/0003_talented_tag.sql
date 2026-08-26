CREATE TYPE "public"."opportunity_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('upi_evening_failure', 'mobile_card_failure', 'customer_retry_behavior', 'other');--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "type" "opportunity_type" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "severity" "opportunity_severity" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "affected_transaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "affected_payment_value" numeric(19, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "estimated_opportunity_value" numeric(19, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "confidence" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "detected_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "opportunities_merchant_type_idx" ON "opportunities" USING btree ("merchant_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_active_type_unique" ON "opportunities" USING btree ("merchant_id","type") WHERE status in ('open', 'in_review');