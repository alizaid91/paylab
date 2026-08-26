ALTER TYPE "public"."strategy_status" ADD VALUE 'generated' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'simulated' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'reviewed' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'policy_approved' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'merchant_approved' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'executing' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'completed' BEFORE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."strategy_status" ADD VALUE 'failed' BEFORE 'proposed';--> statement-breakpoint
ALTER TABLE "execution_results" ADD COLUMN "actual_recovery" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "affected_transaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "expected_recovery" numeric(19, 4) DEFAULT '0' NOT NULL;