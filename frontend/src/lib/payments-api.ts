import { apiClient } from "@/lib/api-client";

type ApiResponse<T> = { success: boolean; data: T };

export interface PaymentStats {
  totalTransactions: number;
  totalAmount: string;
  successfulAmount: string;
  failedTransactions: number;
  byStatus: Array<{ status: string; count: number; amount: string }>;
}

export interface PaymentListItem {
  id: string;
  externalId: string;
  customerId: string | null;
  customerExternalId: string | null;
  customerName: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string;
  provider: string;
  paidAt: string | null;
  createdAt: string;
  attemptCount: number;
}

export interface PaymentAttempt {
  id: string;
  attemptNumber: number;
  status: string;
  providerPaymentId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface PaymentDetails extends PaymentListItem {
  metadata: Record<string, unknown>;
  updatedAt: string;
  attempts: PaymentAttempt[];
}

export interface PaymentListResponse {
  items: PaymentListItem[];
  summary: {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalPaymentValue: string;
    successRate: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export function getPayments(params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return apiClient<ApiResponse<PaymentListResponse>>(`/payments?${search.toString()}`).then((response) => response.data);
}

export function getPayment(id: string) {
  return apiClient<ApiResponse<PaymentDetails>>(`/payments/${id}`).then((response) => response.data);
}

export function getPaymentStats() {
  return apiClient<ApiResponse<PaymentStats>>("/payments/stats").then((response) => response.data);
}

export function generateDemoData() {
  return apiClient<ApiResponse<{
    generated: boolean;
    customers: number;
    payments: number;
    paymentAttempts: number;
  }>>("/payments/demo-data", { method: "POST" }).then((response) => response.data);
}
