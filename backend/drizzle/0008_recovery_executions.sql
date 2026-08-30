CREATE TYPE "public"."recovery_execution_status" AS ENUM('pending', 'eligibility_check', 'scheduled', 'executing', 'success', 'failed', 'skipped', 'stopped');
--> statement-breakpoint
CREATE TABLE "recovery_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "strategy_id" uuid NOT NULL,
  "status" "recovery_execution_status" DEFAULT 'pending' NOT NULL,
  "attempt_number" integer DEFAULT 1 NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "amount" numeric(19,4) DEFAULT '0' NOT NULL,
  "recovered_amount" numeric(19,4) DEFAULT '0' NOT NULL,
  "failure_reason" varchar(255),
  "skip_reason" varchar(255),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_campaign_id_recovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."recovery_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_executions" ADD CONSTRAINT "recovery_executions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_executions_idempotency_unique" ON "recovery_executions" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "recovery_executions_campaign_status_idx" ON "recovery_executions" ("campaign_id", "status");
--> statement-breakpoint
CREATE INDEX "recovery_executions_payment_idx" ON "recovery_executions" ("payment_id");
--> statement-breakpoint
CREATE INDEX "recovery_executions_strategy_idx" ON "recovery_executions" ("strategy_id");
