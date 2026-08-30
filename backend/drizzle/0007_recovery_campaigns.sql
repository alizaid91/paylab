CREATE TYPE "public"."recovery_campaign_status" AS ENUM('draft', 'approved', 'queued', 'running', 'paused', 'completed', 'stopped_by_rule', 'cancelled', 'failed');
--> statement-breakpoint
CREATE TABLE "recovery_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  "revenue_at_risk" numeric(19,4) DEFAULT '0' NOT NULL,
  "expected_recovery_amount" numeric(19,4) DEFAULT '0' NOT NULL,
  "recovered_amount" numeric(19,4) DEFAULT '0' NOT NULL,
  "stopping_reason" text,
  "approved_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recovery_campaigns_merchant_status_idx" ON "recovery_campaigns" ("merchant_id", "status");
--> statement-breakpoint
CREATE INDEX "recovery_campaigns_opportunity_id_idx" ON "recovery_campaigns" ("opportunity_id");
--> statement-breakpoint
CREATE INDEX "recovery_campaigns_strategy_id_idx" ON "recovery_campaigns" ("strategy_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_campaigns_strategy_unique" ON "recovery_campaigns" ("merchant_id", "strategy_id");
