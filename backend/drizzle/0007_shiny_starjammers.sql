CREATE TYPE "public"."recovery_campaign_status" AS ENUM('draft', 'approved', 'queued', 'running', 'paused', 'completed', 'stopped_by_rule', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recovery_execution_status" AS ENUM('pending', 'eligibility_check', 'scheduled', 'executing', 'success', 'failed', 'skipped', 'stopped');--> statement-breakpoint
ALTER TYPE "public"."audit_entity_type" ADD VALUE 'recovery_campaign';--> statement-breakpoint
ALTER TYPE "public"."audit_entity_type" ADD VALUE 'recovery_execution';--> statement-breakpoint
CREATE TABLE "recovery_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"status" "recovery_campaign_status" DEFAULT 'draft' NOT NULL,
	"strategy_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_count" integer DEFAULT 0 NOT NULL,
	"eligible_count" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"successful_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"revenue_at_risk" numeric(19, 4) DEFAULT '0' NOT NULL,
	"expected_recovery_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"recovered_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"stopping_reason" text,
	"approved_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"status" "recovery_execution_status" DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"recovered_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"failure_reason" varchar(255),
	"skip_reason" varchar(255),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_campaign_id_recovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."recovery_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recovery_campaigns_merchant_status_idx" ON "recovery_campaigns" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "recovery_campaigns_opportunity_id_idx" ON "recovery_campaigns" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "recovery_campaigns_strategy_id_idx" ON "recovery_campaigns" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_campaigns_strategy_unique" ON "recovery_campaigns" USING btree ("merchant_id","strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_executions_idempotency_unique" ON "recovery_executions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "recovery_executions_campaign_status_idx" ON "recovery_executions" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "recovery_executions_payment_idx" ON "recovery_executions" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "recovery_executions_strategy_idx" ON "recovery_executions" USING btree ("strategy_id");