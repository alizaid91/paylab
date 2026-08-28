import { apiClient } from "@/lib/api-client";

export interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  defaultCurrency: string;
  timezone: string;
}

export interface Session {
  user: User;
  merchant: Merchant | null;
}

interface AuthResponse extends Session {
  accessToken: string;
}

interface ApiResponse<T> { success: boolean; data: T; }

export function getCurrentUser() {
  return apiClient<ApiResponse<Session>>("/auth/me").then((response) => response.data);
}

export function getMerchant() {
  return apiClient<ApiResponse<Merchant>>("/merchant").then((response) => response.data);
}

export function updateMerchant(input: Partial<Pick<Merchant, "name" | "slug" | "defaultCurrency" | "timezone">>) {
  return apiClient<ApiResponse<Merchant>>("/merchant", { method: "PUT", body: JSON.stringify(input) }).then((response) => response.data);
}

export function login(input: { email: string; password: string }) {
  return apiClient<ApiResponse<AuthResponse>>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  }).then((response) => response.data);
}

export function register(input: {
  email: string;
  password: string;
  merchant: { name: string; slug: string; defaultCurrency: string; timezone: string };
}) {
  return apiClient<ApiResponse<AuthResponse>>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  }).then((response) => response.data);
}
