"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNavigation } from "@/components/layout/top-navigation";
import { useAuth } from "@/components/providers/auth-provider";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register") return <>{children}</>;
  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <TopNavigation onMenuClick={() => setSidebarOpen(true)} onLogout={logout} />
        <main>{children}</main>
      </div>
    </div>
  );
}
