import { apiClient } from "@/lib/api-client";

type ApiResponse<T> = { success: boolean; data: T };

export interface PaymentStats {
  totalTransactions: number;
  totalAmount: string;
  successfulAmount: string;
  failedTransactions: number;
  byStatus: Array<{ status: string; count: number; amount: string }>;
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
