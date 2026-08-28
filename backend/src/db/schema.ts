import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
};

export const userRoleEnum = pgEnum('user_role', ['admin', 'merchant_admin', 'analyst', 'operator']);
export const merchantStatusEnum = pgEnum('merchant_status', ['active', 'suspended', 'inactive']);
export const merchantDataSourceEnum = pgEnum('merchant_data_source', ['none', 'demo', 'razorpay_live']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded', 'cancelled']);
export const paymentMethodEnum = pgEnum('payment_method', ['upi', 'card', 'net_banking']);
export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', ['pending', 'succeeded', 'failed']);
export const opportunityStatusEnum = pgEnum('opportunity_status', ['open', 'in_review', 'accepted', 'dismissed', 'expired']);
export const opportunityTypeEnum = pgEnum('opportunity_type', ['upi_evening_failure', 'mobile_card_failure', 'customer_retry_behavior', 'other']);
export const opportunitySeverityEnum = pgEnum('opportunity_severity', ['low', 'medium', 'high', 'critical']);
export const strategyStatusEnum = pgEnum('strategy_status', ['draft', 'generated', 'simulated', 'reviewed', 'policy_approved', 'merchant_approved', 'executing', 'completed', 'failed', 'proposed', 'approved', 'rejected', 'archived']);
export const strategyTypeEnum = pgEnum('strategy_type', ['pricing', 'checkout', 'payment_method', 'retention', 'promotion', 'other']);
export const simulationStatusEnum = pgEnum('simulation_status', ['queued', 'running', 'completed', 'failed']);
export const advisoryStatusEnum = pgEnum('advisory_status', ['pending', 'approved', 'rejected', 'needs_review']);
export const policyStatusEnum = pgEnum('policy_status', ['draft', 'active', 'inactive', 'archived']);
export const policyResultStatusEnum = pgEnum('policy_result_status', ['pending', 'passed', 'failed', 'overridden']);
export const executionStatusEnum = pgEnum('execution_status', ['pending_approval', 'approved', 'queued', 'running', 'completed', 'failed', 'cancelled']);
export const executionResultStatusEnum = pgEnum('execution_result_status', ['succeeded', 'failed', 'partial']);
export const auditEntityTypeEnum = pgEnum('audit_entity_type', ['payment', 'opportunity', 'strategy', 'simulation', 'advisory_review', 'policy', 'execution']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('analyst'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps
}, (table) => [uniqueIndex('users_email_unique').on(table.email)]);

export const merchants = pgTable('merchants', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
  timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
  dataSource: merchantDataSourceEnum('data_source').notNull().default('none'),
  status: merchantStatusEnum('status').notNull().default('active'),
  ...timestamps
}, (table) => [
  uniqueIndex('merchants_slug_unique').on(table.slug),
  index('merchants_owner_user_id_idx').on(table.ownerUserId),
  index('merchants_status_idx').on(table.status)
]);

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }),
  name: varchar('name', { length: 200 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps
}, (table) => [
  uniqueIndex('customers_merchant_external_id_unique').on(table.merchantId, table.externalId),
  index('customers_merchant_email_idx').on(table.merchantId, table.email)
]);

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  paymentMethod: paymentMethodEnum('payment_method').notNull().default('card'),
  provider: varchar('provider', { length: 100 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps
}, (table) => [
  uniqueIndex('payments_merchant_external_id_unique').on(table.merchantId, table.externalId),
  index('payments_merchant_status_idx').on(table.merchantId, table.status),
  index('payments_merchant_method_idx').on(table.merchantId, table.paymentMethod),
  index('payments_merchant_created_at_idx').on(table.merchantId, table.createdAt),
  index('payments_customer_id_idx').on(table.customerId),
  index('payments_paid_at_idx').on(table.merchantId, table.paidAt)
]);

export const paymentAttempts = pgTable('payment_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  status: paymentAttemptStatusEnum('status').notNull().default('pending'),
  providerPaymentId: varchar('provider_payment_id', { length: 255 }),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex('payment_attempts_payment_number_unique').on(table.paymentId, table.attemptNumber),
  index('payment_attempts_merchant_status_idx').on(table.merchantId, table.status),
  index('payment_attempts_provider_payment_id_idx').on(table.providerPaymentId)
]);

export const opportunities = pgTable('opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  status: opportunityStatusEnum('status').notNull().default('open'),
  type: opportunityTypeEnum('type').notNull().default('other'),
  severity: opportunitySeverityEnum('severity').notNull().default('medium'),
  category: varchar('category', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  priority: integer('priority').notNull().default(0),
  affectedTransactionCount: integer('affected_transaction_count').notNull().default(0),
  affectedPaymentValue: numeric('affected_payment_value', { precision: 19, scale: 4 }).notNull().default('0'),
  estimatedImpact: numeric('estimated_impact', { precision: 19, scale: 4 }),
  estimatedOpportunityValue: numeric('estimated_opportunity_value', { precision: 19, scale: 4 }).notNull().default('0'),
  confidence: numeric('confidence', { precision: 5, scale: 2 }).notNull().default('0'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  ...timestamps
}, (table) => [
  index('opportunities_merchant_status_idx').on(table.merchantId, table.status),
  index('opportunities_merchant_priority_idx').on(table.merchantId, table.priority),
  index('opportunities_merchant_type_idx').on(table.merchantId, table.type),
  uniqueIndex('opportunities_active_type_unique').on(table.merchantId, table.type)
    .where(sql`status in ('open', 'in_review')`)
]);

export const strategies = pgTable('strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: strategyTypeEnum('type').notNull(),
  status: strategyStatusEnum('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps
}, (table) => [
  index('strategies_merchant_status_idx').on(table.merchantId, table.status),
  index('strategies_opportunity_id_idx').on(table.opportunityId),
  uniqueIndex('strategies_merchant_name_version_unique').on(table.merchantId, table.name, table.version)
]);

export const simulations = pgTable('simulations', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  status: simulationStatusEnum('status').notNull().default('queued'),
  input: jsonb('input').$type<Record<string, unknown>>().notNull().default({}),
  output: jsonb('output').$type<Record<string, unknown>>(),
  projectedRevenue: numeric('projected_revenue', { precision: 19, scale: 4 }),
  projectedConversionRate: numeric('projected_conversion_rate', { precision: 7, scale: 4 }),
  errorMessage: text('error_message'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps
}, (table) => [
  index('simulations_merchant_status_idx').on(table.merchantId, table.status),
  index('simulations_strategy_id_idx').on(table.strategyId)
]);

export const advisoryReviews = pgTable('advisory_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  simulationId: uuid('simulation_id').notNull().references(() => simulations.id, { onDelete: 'cascade' }),
  reviewerUserId: uuid('reviewer_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: advisoryStatusEnum('status').notNull().default('pending'),
  recommendation: varchar('recommendation', { length: 100 }).notNull(),
  rationale: text('rationale').notNull(),
  riskAssessment: jsonb('risk_assessment').$type<Record<string, unknown>>().notNull().default({}),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ...timestamps
}, (table) => [
  index('advisory_reviews_merchant_status_idx').on(table.merchantId, table.status),
  uniqueIndex('advisory_reviews_simulation_unique').on(table.simulationId)
]);

export const policies = pgTable('policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: policyStatusEnum('status').notNull().default('draft'),
  rules: jsonb('rules').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps
}, (table) => [
  uniqueIndex('policies_merchant_name_unique').on(table.merchantId, table.name),
  index('policies_merchant_status_idx').on(table.merchantId, table.status)
]);

export const policyResults = pgTable('policy_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  advisoryReviewId: uuid('advisory_review_id').references(() => advisoryReviews.id, { onDelete: 'set null' }),
  simulationId: uuid('simulation_id').references(() => simulations.id, { onDelete: 'set null' }),
  status: policyResultStatusEnum('status').notNull().default('pending'),
  decision: varchar('decision', { length: 100 }).notNull(),
  reasons: jsonb('reasons').$type<Array<Record<string, unknown>>>().notNull().default([]),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps
}, (table) => [
  index('policy_results_merchant_status_idx').on(table.merchantId, table.status),
  index('policy_results_policy_id_idx').on(table.policyId),
  index('policy_results_advisory_review_id_idx').on(table.advisoryReviewId)
]);

export const executions = pgTable('executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id, { onDelete: 'restrict' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  policyResultId: uuid('policy_result_id').references(() => policyResults.id, { onDelete: 'set null' }),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: executionStatusEnum('status').notNull().default('pending_approval'),
  affectedTransactionCount: integer('affected_transaction_count').notNull().default(0),
  expectedRecovery: numeric('expected_recovery', { precision: 19, scale: 4 }).notNull().default('0'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps
}, (table) => [
  index('executions_merchant_status_idx').on(table.merchantId, table.status),
  index('executions_strategy_id_idx').on(table.strategyId),
  index('executions_scheduled_at_idx').on(table.merchantId, table.scheduledAt),
  uniqueIndex('executions_strategy_unique').on(table.merchantId, table.strategyId)
]);

export const executionResults = pgTable('execution_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  status: executionResultStatusEnum('status').notNull(),
  resultType: varchar('result_type', { length: 100 }).notNull(),
  actualRevenue: numeric('actual_revenue', { precision: 19, scale: 4 }),
  actualRecovery: numeric('actual_recovery', { precision: 19, scale: 4 }),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  ...timestamps
}, (table) => [
  uniqueIndex('execution_results_execution_unique').on(table.executionId),
  index('execution_results_merchant_status_idx').on(table.merchantId, table.status)
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: auditEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('audit_logs_merchant_created_at_idx').on(table.merchantId, table.createdAt),
  index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  index('audit_logs_actor_user_id_idx').on(table.actorUserId)
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  ownedMerchants: many(merchants, { relationName: 'merchantOwner' }),
  createdStrategies: many(strategies, { relationName: 'strategyCreator' }),
  approvedStrategies: many(strategies, { relationName: 'strategyApprover' }),
  reviewedAdvisories: many(advisoryReviews),
  createdPolicies: many(policies),
  approvedExecutions: many(executions),
  auditLogs: many(auditLogs)
}));

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  owner: one(users, { fields: [merchants.ownerUserId], references: [users.id], relationName: 'merchantOwner' }),
  customers: many(customers),
  payments: many(payments),
  paymentAttempts: many(paymentAttempts),
  opportunities: many(opportunities),
  strategies: many(strategies),
  simulations: many(simulations),
  advisoryReviews: many(advisoryReviews),
  policies: many(policies),
  policyResults: many(policyResults),
  executions: many(executions),
  executionResults: many(executionResults),
  auditLogs: many(auditLogs)
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  merchant: one(merchants, { fields: [customers.merchantId], references: [merchants.id] }),
  payments: many(payments)
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  merchant: one(merchants, { fields: [payments.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [payments.customerId], references: [customers.id] }),
  attempts: many(paymentAttempts),
  opportunities: many(opportunities)
}));

export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  merchant: one(merchants, { fields: [paymentAttempts.merchantId], references: [merchants.id] }),
  payment: one(payments, { fields: [paymentAttempts.paymentId], references: [payments.id] })
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  merchant: one(merchants, { fields: [opportunities.merchantId], references: [merchants.id] }),
  payment: one(payments, { fields: [opportunities.paymentId], references: [payments.id] }),
  strategies: many(strategies),
  executions: many(executions)
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  merchant: one(merchants, { fields: [strategies.merchantId], references: [merchants.id] }),
  opportunity: one(opportunities, { fields: [strategies.opportunityId], references: [opportunities.id] }),
  creator: one(users, { fields: [strategies.createdByUserId], references: [users.id], relationName: 'strategyCreator' }),
  approver: one(users, { fields: [strategies.approvedByUserId], references: [users.id], relationName: 'strategyApprover' }),
  simulations: many(simulations),
  executions: many(executions)
}));

export const simulationsRelations = relations(simulations, ({ one, many }) => ({
  merchant: one(merchants, { fields: [simulations.merchantId], references: [merchants.id] }),
  strategy: one(strategies, { fields: [simulations.strategyId], references: [strategies.id] }),
  advisoryReviews: many(advisoryReviews),
  policyResults: many(policyResults)
}));

export const advisoryReviewsRelations = relations(advisoryReviews, ({ one, many }) => ({
  merchant: one(merchants, { fields: [advisoryReviews.merchantId], references: [merchants.id] }),
  simulation: one(simulations, { fields: [advisoryReviews.simulationId], references: [simulations.id] }),
  reviewer: one(users, { fields: [advisoryReviews.reviewerUserId], references: [users.id] }),
  policyResults: many(policyResults)
}));

export const policiesRelations = relations(policies, ({ one, many }) => ({
  merchant: one(merchants, { fields: [policies.merchantId], references: [merchants.id] }),
  creator: one(users, { fields: [policies.createdByUserId], references: [users.id] }),
  results: many(policyResults)
}));

export const policyResultsRelations = relations(policyResults, ({ one, many }) => ({
  merchant: one(merchants, { fields: [policyResults.merchantId], references: [merchants.id] }),
  policy: one(policies, { fields: [policyResults.policyId], references: [policies.id] }),
  advisoryReview: one(advisoryReviews, { fields: [policyResults.advisoryReviewId], references: [advisoryReviews.id] }),
  simulation: one(simulations, { fields: [policyResults.simulationId], references: [simulations.id] }),
  executions: many(executions)
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  merchant: one(merchants, { fields: [executions.merchantId], references: [merchants.id] }),
  strategy: one(strategies, { fields: [executions.strategyId], references: [strategies.id] }),
  opportunity: one(opportunities, { fields: [executions.opportunityId], references: [opportunities.id] }),
  policyResult: one(policyResults, { fields: [executions.policyResultId], references: [policyResults.id] }),
  approver: one(users, { fields: [executions.approvedByUserId], references: [users.id] }),
  result: one(executionResults)
}));

export const executionResultsRelations = relations(executionResults, ({ one }) => ({
  merchant: one(merchants, { fields: [executionResults.merchantId], references: [merchants.id] }),
  execution: one(executions, { fields: [executionResults.executionId], references: [executions.id] })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  merchant: one(merchants, { fields: [auditLogs.merchantId], references: [merchants.id] }),
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] })
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
