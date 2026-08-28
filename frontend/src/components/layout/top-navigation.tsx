"use client";

import Link from "next/link";
import { Bell, Database, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

export function TopNavigation({ onMenuClick, onLogout }: Readonly<{ onMenuClick: () => void; onLogout: () => void }>) {
  const { session } = useAuth();
  const initials = session?.user.email.slice(0, 2).toUpperCase() ?? "U";
  const dataSource = session?.merchant?.dataSource;
  const dataSourceLabel = dataSource === "demo" ? "Demo Data" : dataSource === "razorpay_live" ? "Razorpay Live Data" : "No data source";
  const showConnectDataSource = dataSource === "none";
  return <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><Button variant="ghost" size="sm" className="px-2 lg:hidden" onClick={onMenuClick} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button><div className="hidden items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground md:flex"><Search className="h-4 w-4" /><span>Search</span><kbd className="ml-8 rounded border bg-muted px-1.5 text-[10px]">⌘ K</kbd></div></div><div className="flex items-center gap-2">{showConnectDataSource && <Button asChild size="sm"><Link href="/data-source">Connect Data Source</Link></Button>}<div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-[11px] font-medium text-muted-foreground sm:px-3 sm:text-xs"><Database className="h-3.5 w-3.5 text-accent" />{dataSourceLabel}</div><Button variant="ghost" size="sm" className="px-2" aria-label="Notifications"><Bell className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="px-2" onClick={onLogout} aria-label="Log out"><LogOut className="h-4 w-4" /></Button><div className="ml-1 flex items-center gap-2 border-l pl-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials}</span><div className="hidden max-w-40 text-left sm:block"><p className="truncate text-sm font-medium">{session?.user.email}</p><p className="text-xs text-muted-foreground">{session?.user.role.replace("_", " ")}</p></div></div></div></header>;
}
