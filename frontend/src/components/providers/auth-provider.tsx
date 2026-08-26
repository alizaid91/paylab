"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo } from "react";
import { clearAccessToken, getAccessToken } from "@/lib/api-client";
import { getCurrentUser, type Session } from "@/lib/auth-api";

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const hasToken = Boolean(getAccessToken());
  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    enabled: hasToken,
    retry: false
  });
  const session = authQuery.data ?? null;
  const publicRoute = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (authQuery.isError) {
      clearAccessToken();
      queryClient.setQueryData(["auth", "me"], null);
    }
  }, [authQuery.isError, queryClient]);

  useEffect(() => {
    if (hasToken && authQuery.isPending) return;
    if (session && publicRoute) router.replace("/dashboard");
    if (!session && !publicRoute) router.replace("/login");
  }, [authQuery.isPending, hasToken, publicRoute, router, session]);

  const value = useMemo(() => ({
    session,
    isLoading: hasToken && authQuery.isPending,
    isAuthenticated: Boolean(session),
    logout: () => {
      clearAccessToken();
      queryClient.clear();
      router.replace("/login");
    }
  }), [authQuery.isPending, hasToken, queryClient, router, session]);

  if ((hasToken && authQuery.isPending) || (!session && !publicRoute) || (session && publicRoute)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-accent" />Loading your workspace...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
