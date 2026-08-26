import { apiClient } from "@/lib/api-client";

export interface AnalyticsOverview {
  totalPaymentVolume: string;
  successfulRevenue: string;
  failedPaymentValue: string;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  failureRate: number;
  averageTransactionValue: string;
  retryRate: number;
}

export interface PaymentMethodAnalytics {
  paymentMethod: string;
  transactionCount: number;
  volume: string;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  failureRate: number;
  failedPaymentValue: string;
}

export interface FailureAnalyticsItem {
  dimension: string | number;
  failedTransactions: number;
  failedPaymentValue: string;
  totalTransactions: number;
  failureRate: number;
}

export interface FailureAnalytics {
  groupBy: "paymentMethod" | "hour" | "date" | "device";
  items: FailureAnalyticsItem[];
}

export interface TrendAnalyticsItem {
  period: string;
  transactions: number;
  volume: string;
  successfulRevenue: string;
  failedPaymentValue: string;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
}

export interface TrendAnalytics {
  interval: "day" | "week" | "month";
  items: TrendAnalyticsItem[];
}

type ApiResponse<T> = { success: boolean; data: T };
type AnalyticsRange = { from?: string; to?: string };

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export function getAnalyticsOverview(range: AnalyticsRange = {}) {
  return apiClient<ApiResponse<AnalyticsOverview>>(`/analytics/overview${queryString(range)}`)
    .then((response) => response.data);
}

export function getPaymentMethodAnalytics(range: AnalyticsRange = {}) {
  return apiClient<ApiResponse<PaymentMethodAnalytics[]>>(`/analytics/payment-methods${queryString(range)}`)
    .then((response) => response.data);
}

export function getFailureAnalytics(groupBy: "paymentMethod" | "hour", range: AnalyticsRange = {}) {
  return apiClient<ApiResponse<FailureAnalytics>>(`/analytics/failures${queryString({ ...range, groupBy })}`)
    .then((response) => response.data);
}

export function getTrendAnalytics(interval: "day" | "week" | "month" = "day", range: AnalyticsRange = {}) {
  return apiClient<ApiResponse<TrendAnalytics>>(`/analytics/trends${queryString({ ...range, interval })}`)
    .then((response) => response.data);
}
