"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CreditCard, IndianRupee, TrendingUp } from "lucide-react";
import { getAnalyticsOverview, type AnalyticsOverview } from "@/lib/analytics-api";
import { useAuth } from "@/components/providers/auth-provider";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/states/error-state";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (value: string) => currency.format(Number(value) || 0);
const percent = (value: number) => `${Number(value || 0).toFixed(2)}%`;

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function KpiCard({ label, value, context, icon: Icon, tone }: Readonly<{ label: string; value: string; context: string; icon: typeof CreditCard; tone: string }>) {
  return <div className="rounded-lg border bg-card p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className={`rounded-md p-2 ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{context}</p></div>;
}

function DashboardData({ data }: { data: AnalyticsOverview }) {
  const transactions = data.successfulTransactions + data.failedTransactions;
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Total Payment Volume" value={money(data.totalPaymentVolume)} context={`${transactions.toLocaleString("en-IN")} total transactions`} icon={IndianRupee} tone="bg-emerald-50 text-emerald-700" /><KpiCard label="Successful Revenue" value={money(data.successfulRevenue)} context={`${data.successfulTransactions.toLocaleString("en-IN")} successful payments`} icon={CheckCircle2} tone="bg-blue-50 text-blue-700" /><KpiCard label="Success Rate" value={percent(data.successRate)} context={`${percent(data.retryRate)} retry rate`} icon={TrendingUp} tone="bg-violet-50 text-violet-700" /><KpiCard label="Failed Payment Value" value={money(data.failedPaymentValue)} context={`${data.failedTransactions.toLocaleString("en-IN")} failed payments`} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" /></div><div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-lg border bg-card"><div className="border-b p-5"><h2 className="font-semibold">Revenue Opportunities</h2><p className="mt-1 text-sm text-muted-foreground">Prioritized opportunities to improve your revenue.</p></div><div className="flex min-h-40 flex-col items-center justify-center p-6 text-center"><TrendingUp className="h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">No opportunities to display yet</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">Opportunity recommendations will appear here when enough payment data is available.</p></div></section><section className="rounded-lg border bg-card"><div className="border-b p-5"><h2 className="font-semibold">Payment Performance</h2><p className="mt-1 text-sm text-muted-foreground">A summary of your current payment outcomes.</p></div><div className="space-y-5 p-5"><div><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">Successful payments</span><span className="font-medium">{percent(data.successRate)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(data.successRate, 100)}%` }} /></div></div><div className="grid grid-cols-2 gap-4 border-t pt-5"><div><p className="text-xs text-muted-foreground">Average transaction</p><p className="mt-1 font-semibold">{money(data.averageTransactionValue)}</p></div><div><p className="text-xs text-muted-foreground">Failed payment rate</p><p className="mt-1 font-semibold">{percent(data.failureRate)}</p></div></div><div className="flex items-center gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground"><CreditCard className="h-4 w-4 shrink-0" />Performance is based on all payments in the selected period.</div></div></section></div></>;
}

export function DashboardContent() {
  const { session } = useAuth();
  const overview = useQuery({ queryKey: ["analytics", "overview"], queryFn: () => getAnalyticsOverview() });
  return <ContentContainer><PageHeader eyebrow={session?.merchant?.name ?? "Workspace"} title="Revenue Overview" description="Monitor payment performance and revenue opportunities." /><div className="mt-8">{overview.isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-lg border bg-card p-5"><div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-8" /></div><Skeleton className="mt-5 h-8 w-36" /><Skeleton className="mt-2 h-3 w-24" /></div>)}</div>}{overview.isError && <ErrorState message="Unable to load payment analytics. Please try again." />}{overview.data && <DashboardData data={overview.data} />}{overview.data && overview.data.totalPaymentVolume === "0" && <div className="mt-6 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No payment activity has been recorded for this merchant yet.</div>}</div></ContentContainer>;
}
