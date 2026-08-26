import { ApiError } from "@/lib/api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("paylab_access_token");
}

export function clearAccessToken() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem("paylab_access_token");
}

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const contentType = response.headers.get("content-type");
  const body: unknown = contentType?.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401) clearAccessToken();
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string"
      ? body.error.message : "The request could not be completed.";
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}
