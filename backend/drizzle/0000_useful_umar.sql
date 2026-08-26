CREATE TYPE "public"."advisory_status" AS ENUM('pending', 'approved', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('payment', 'opportunity', 'strategy', 'simulation', 'advisory_review', 'policy', 'execution');--> statement-breakpoint
CREATE TYPE "public"."execution_result_status" AS ENUM('succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('pending_approval', 'approved', 'queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('active', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('open', 'in_review', 'accepted', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."policy_result_status" AS ENUM('pending', 'passed', 'failed', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."policy_status" AS ENUM('draft', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."simulation_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."strategy_status" AS ENUM('draft', 'proposed', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."strategy_type" AS ENUM('pricing', 'checkout', 'payment_method', 'retention', 'promotion', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'merchant_admin', 'analyst', 'operator');--> statement-breakpoint
CREATE TABLE "advisory_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL,
	"reviewer_user_id" uuid,
	"status" "advisory_status" DEFAULT 'pending' NOT NULL,
	"recommendation" varchar(100) NOT NULL,
	"rationale" text NOT NULL,
	"risk_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(320),
	"name" varchar(200),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"execution_id" uuid NOT NULL,
	"status" "execution_result_status" NOT NULL,
	"result_type" varchar(100) NOT NULL,
	"actual_revenue" numeric(19, 4),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"policy_result_id" uuid,
	"approved_by_user_id" uuid,
	"status" "execution_status" DEFAULT 'pending_approval' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"default_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"status" "merchant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"payment_id" uuid,
	"status" "opportunity_status" DEFAULT 'open' NOT NULL,
	"category" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"estimated_impact" numeric(19, 4),
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"provider_payment_id" varchar(255),
	"error_code" varchar(100),
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid,
	"external_id" varchar(255) NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" varchar(100) NOT NULL,
	"paid_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "policy_status" DEFAULT 'draft' NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"advisory_review_id" uuid,
	"simulation_id" uuid,
	"status" "policy_result_status" DEFAULT 'pending' NOT NULL,
	"decision" varchar(100) NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"status" "simulation_status" DEFAULT 'queued' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"projected_revenue" numeric(19, 4),
	"projected_conversion_rate" numeric(7, 4),
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" "strategy_type" NOT NULL,
	"status" "strategy_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'analyst' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisory_reviews" ADD CONSTRAINT "advisory_reviews_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_reviews" ADD CONSTRAINT "advisory_reviews_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_reviews" ADD CONSTRAINT "advisory_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_results" ADD CONSTRAINT "execution_results_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_results" ADD CONSTRAINT "execution_results_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_policy_result_id_policy_results_id_fk" FOREIGN KEY ("policy_result_id") REFERENCES "public"."policy_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_advisory_review_id_advisory_reviews_id_fk" FOREIGN KEY ("advisory_review_id") REFERENCES "public"."advisory_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisory_reviews_merchant_status_idx" ON "advisory_reviews" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "advisory_reviews_simulation_unique" ON "advisory_reviews" USING btree ("simulation_id");--> statement-breakpoint
CREATE INDEX "audit_logs_merchant_created_at_idx" ON "audit_logs" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_merchant_external_id_unique" ON "customers" USING btree ("merchant_id","external_id");--> statement-breakpoint
CREATE INDEX "customers_merchant_email_idx" ON "customers" USING btree ("merchant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_results_execution_unique" ON "execution_results" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "execution_results_merchant_status_idx" ON "execution_results" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "executions_merchant_status_idx" ON "executions" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "executions_strategy_id_idx" ON "executions" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "executions_scheduled_at_idx" ON "executions" USING btree ("merchant_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_unique" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merchants_owner_user_id_idx" ON "merchants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_merchant_status_idx" ON "opportunities" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "opportunities_merchant_priority_idx" ON "opportunities" USING btree ("merchant_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_payment_number_unique" ON "payment_attempts" USING btree ("payment_id","attempt_number");--> statement-breakpoint
CREATE INDEX "payment_attempts_merchant_status_idx" ON "payment_attempts" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "payment_attempts_provider_payment_id_idx" ON "payment_attempts" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_merchant_external_id_unique" ON "payments" USING btree ("merchant_id","external_id");--> statement-breakpoint
CREATE INDEX "payments_merchant_status_idx" ON "payments" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "payments_customer_id_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("merchant_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "policies_merchant_name_unique" ON "policies" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE INDEX "policies_merchant_status_idx" ON "policies" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "policy_results_merchant_status_idx" ON "policy_results" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "policy_results_policy_id_idx" ON "policy_results" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "policy_results_advisory_review_id_idx" ON "policy_results" USING btree ("advisory_review_id");--> statement-breakpoint
CREATE INDEX "simulations_merchant_status_idx" ON "simulations" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "simulations_strategy_id_idx" ON "simulations" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategies_merchant_status_idx" ON "strategies" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "strategies_opportunity_id_idx" ON "strategies" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategies_merchant_name_version_unique" ON "strategies" USING btree ("merchant_id","name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");