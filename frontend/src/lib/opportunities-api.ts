import { apiClient } from "@/lib/api-client";

export type OpportunityStatus = "open" | "in_review" | "accepted" | "dismissed" | "expired";
export type OpportunitySeverity = "low" | "medium" | "high" | "critical";
export type OpportunityType = "upi_evening_failure" | "mobile_card_failure" | "customer_retry_behavior" | "other";

export interface OpportunityStrategy {
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  type: OpportunityType;
  severity: OpportunitySeverity;
  status: OpportunityStatus;
  affectedTransactionCount: number;
  affectedPaymentValue: string;
  estimatedOpportunityValue: string;
  confidence: string;
  detectedAt: string;
  evidence: Record<string, unknown>;
  strategies: OpportunityStrategy[];
}

export interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  configuration: Record<string, unknown>;
  createdAt: string;
  opportunity: {
    id: string;
    name: string;
    affectedTransactionCount: number;
    estimatedOpportunityValue: string;
  } | null;
  advisoryReview: AdvisoryReview | null;
  policyCheck: {
    id: string;
    status: string;
    decision: string;
    reasons: Array<Record<string, unknown>>;
    evaluatedValues?: Record<string, unknown>;
    evaluatedAt: string;
  } | null;
}

export interface OpportunityList {
  items: Opportunity[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AnalyzeResult {
  detectedAt: string;
  created: Opportunity[];
  createdCount: number;
}

type ApiResponse<T> = { success: boolean; data: T };

export function getOpportunities(params: { status?: string; severity?: string; type?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiClient<ApiResponse<OpportunityList>>(`/opportunities${suffix}`).then((response) => response.data);
}

export function analyzeOpportunities() {
  return apiClient<ApiResponse<AnalyzeResult>>("/opportunities/analyze", { method: "POST" }).then((response) => response.data);
}

export function getOpportunity(id: string) {
  return apiClient<ApiResponse<Opportunity>>(`/opportunities/${id}`).then((response) => response.data);
}

export function generateOpportunityStrategy(id: string) {
  return apiClient<ApiResponse<Strategy>>(`/opportunities/${id}/generate-strategy`, { method: "POST" }).then((response) => response.data);
}

export interface Simulation {
  id: string;
  status: string;
  input: Record<string, unknown>;
  output: {
    currentSuccessRate: number;
    projectedSuccessRate: number;
    currentRevenue: string;
    projectedRevenue: string;
    potentialRevenueRecovery: string;
    totalTransactions: number;
    affectedTransactions: number;
    confidence: number;
    [key: string]: unknown;
  } | null;
  projectedRevenue: string | null;
  projectedConversionRate: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdvisoryReview {
  id: string;
  status: string;
  recommendation: "APPROVE" | "MODIFY" | "REJECT";
  rationale: string;
  riskAssessment: {
    confidence?: number;
    riskLevel?: string;
    concerns?: string[];
    assumptionIssues?: string[];
  };
  reviewedAt: string | null;
  createdAt: string;
}

export interface PolicyCheckResult {
  passed: boolean;
  failedRules: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
  evaluatedValues: Record<string, unknown>;
  evaluatedAt: string;
  policyResult: {
    id: string;
    status: string;
    decision: string;
  };
}

export interface RecoveryCampaign {
  id: string;
  merchantId: string;
  opportunityId: string;
  strategyId: string;
  status: string;
  strategySnapshot: Record<string, unknown>;
  targetCount: number;
  eligibleCount: number;
  processedCount: number;
  successfulCount: number;
  failedCount: number;
  skippedCount: number;
  revenueAtRisk: string;
  expectedRecoveryAmount: string;
  recoveredAmount: string;
  stoppingReason: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Policy {
  id: string;
  name: string;
  status: string;
  rules: {
    maxAffectedTransactionPercentage: number;
    maxRevenueExposurePercentage: number;
    allowedPaymentMethods: string[];
    allowedExecutionHours: { start: number; end: number };
    maxDailyExecutionAmount: string;
    minimumStrategyConfidence: number;
    minimumSimulationConfidence: number;
  };
}

export function getStrategy(id: string) {
  return apiClient<ApiResponse<Strategy>>(`/strategies/${id}`).then((response) => response.data);
}

export function createRecoveryCampaign(strategyId: string) {
  return apiClient<ApiResponse<RecoveryCampaign>>('/recovery-campaigns', {
    method: 'POST',
    body: JSON.stringify({ strategyId })
  }).then((response) => response.data);
}

export function getRecoveryCampaign(id: string) {
  return apiClient<ApiResponse<RecoveryCampaign>>(`/recovery-campaigns/${id}`).then((response) => response.data);
}

export function getRecoveryCampaigns() {
  return apiClient<ApiResponse<RecoveryCampaign[]>>('/recovery-campaigns').then((response) => response.data);
}

export function startRecoveryCampaign(id: string) {
  return apiClient<ApiResponse<RecoveryCampaign>>(`/recovery-campaigns/${id}/start`, {
    method: 'POST',
    body: JSON.stringify({})
  }).then((response) => response.data);
}

export function stopRecoveryCampaign(id: string, reason = 'MERCHANT_CANCELLATION') {
  return apiClient<ApiResponse<RecoveryCampaign>>(`/recovery-campaigns/${id}/stop`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }).then((response) => response.data);
}

export function resumeRecoveryCampaign(id: string) {
  return apiClient<ApiResponse<RecoveryCampaign>>(`/recovery-campaigns/${id}/resume`, {
    method: 'POST',
    body: JSON.stringify({}),
  }).then((response) => response.data);
}

export function simulateStrategy(id: string) {
  return apiClient<ApiResponse<Simulation>>(`/strategies/${id}/simulate`, {
    method: "POST",
    body: JSON.stringify({})
  }).then((response) => response.data);
}

export function getStrategySimulations(id: string) {
  return apiClient<ApiResponse<Simulation[]>>(`/strategies/${id}/simulations`).then((response) => response.data);
}

export function runAdvisoryReview(id: string, simulationId: string) {
  return apiClient<ApiResponse<AdvisoryReview>>(`/strategies/${id}/advisory-review`, {
    method: "POST",
    body: JSON.stringify({ simulationId })
  }).then((response) => response.data);
}

export function runPolicyCheck(id: string) {
  return apiClient<ApiResponse<PolicyCheckResult>>(`/strategies/${id}/policy-check`, {
    method: "POST",
    body: JSON.stringify({})
  }).then((response) => response.data);
}

export function approveStrategy(id: string) {
  return apiClient<ApiResponse<Record<string, unknown>>>(`/strategies/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({})
  }).then((response) => response.data);
}

export function getAuditLogs(strategyId?: string, executionId?: string, campaignId?: string) {
  const params = new URLSearchParams();
  if (strategyId) params.set("strategyId", strategyId);
  if (executionId) params.set("executionId", executionId);
  if (campaignId) params.set("campaignId", campaignId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiClient<ApiResponse<AuditLog[]>>(`/audit-logs${query}`).then((response) => response.data);
}

export function getMerchantPolicy() {
  return apiClient<ApiResponse<Policy>>("/merchant/policies").then((response) => response.data);
}

export function updateMerchantPolicy(rules: Policy["rules"]) {
  return apiClient<ApiResponse<Policy>>("/merchant/policies", { method: "PUT", body: JSON.stringify(rules) }).then((response) => response.data);
}
