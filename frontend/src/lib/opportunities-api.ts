import { apiClient } from "@/lib/api-client";

export type OpportunityStatus = "open" | "in_review" | "accepted" | "dismissed" | "expired";
export type OpportunitySeverity = "low" | "medium" | "high" | "critical";
export type OpportunityType = "upi_evening_failure" | "mobile_card_failure" | "customer_retry_behavior" | "other";

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
  output: {
    currentSuccessRate: number;
    projectedSuccessRate: number;
    currentRevenue: string;
    projectedRevenue: string;
    potentialRevenueRecovery: string;
    totalTransactions: number;
    affectedTransactions: number;
    confidence: number;
  } | null;
  completedAt: string | null;
}

export function getStrategy(id: string) {
  return apiClient<ApiResponse<Strategy>>(`/strategies/${id}`).then((response) => response.data);
}

export function simulateStrategy(id: string) {
  return apiClient<ApiResponse<Simulation>>(`/strategies/${id}/simulate`, {
    method: "POST",
    body: JSON.stringify({})
  }).then((response) => response.data);
}
