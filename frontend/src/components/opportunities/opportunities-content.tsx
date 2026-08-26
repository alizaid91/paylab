"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/states/error-state";
import {
  analyzeOpportunities,
  getOpportunities,
  type Opportunity,
  type OpportunitySeverity,
  type OpportunityStatus,
  type OpportunityType
} from "@/lib/opportunities-api";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (value: string | number) => currency.format(Number(value) || 0);
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function Badge({ children, className }: Readonly<{ children: React.ReactNode; className: string }>) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

function SeverityBadge({ severity }: { severity: OpportunitySeverity }) {
  const className = severity === "high" || severity === "critical" ? "bg-rose-50 text-rose-700" : severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <Badge className={className}>{severity.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: OpportunityStatus }) {
  const className = status === "open" ? "bg-blue-50 text-blue-700" : status === "in_review" ? "bg-violet-50 text-violet-700" : status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
  return <Badge className={className}>{label(status)}</Badge>;
}

function EmptyState() {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center"><Search className="h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">No opportunities found</p><p className="mt-1 text-sm text-muted-foreground">Analyze your payments to discover recoverable revenue opportunities.</p></div>;
}

function OpportunityTable({ items }: { items: Opportunity[] }) {
  if (!items.length) return <EmptyState />;
  return <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[980px] text-left text-sm"><caption className="sr-only">Revenue opportunities</caption><thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Opportunity</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Severity</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Affected transactions</th><th className="px-5 py-3 font-medium">Opportunity value</th><th className="px-5 py-3 font-medium">Confidence</th><th className="px-5 py-3 font-medium">Detection time</th><th aria-hidden="true" /></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.id} className="group hover:bg-muted/30"><th scope="row" className="px-5 py-4 font-medium"><Link href={`/opportunities/${item.id}`} className="flex min-w-48 items-center gap-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.title}<ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></Link></th><td className="px-5 py-4 capitalize">{label(item.type)}</td><td className="px-5 py-4"><SeverityBadge severity={item.severity} /></td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4">{item.affectedTransactionCount.toLocaleString("en-IN")}</td><td className="px-5 py-4">{money(item.estimatedOpportunityValue)}</td><td className="px-5 py-4">{Number(item.confidence).toFixed(2)}%</td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.detectedAt))}</td><td className="px-5 py-4"><Link href={`/opportunities/${item.id}`} aria-label={`View ${item.title}`} className="text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" /></Link></td></tr>)}</tbody></table></div>;
}

export function OpportunitiesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const status = searchParams.get("status") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const type = searchParams.get("type") ?? "";
  const opportunities = useQuery({ queryKey: ["opportunities", { status, severity, type }], queryFn: () => getOpportunities({ status, severity, type }) });
  const analysis = useMutation({ mutationFn: analyzeOpportunities, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["opportunities"] }) });

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
  };

  return <ContentContainer><PageHeader title="Revenue Opportunities" description="Identify where payment performance is creating recoverable revenue." actions={<Button onClick={() => analysis.mutate()} disabled={analysis.isPending}>{analysis.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Analyze Payments</Button>} /><div className="mt-6 space-y-4">
    {analysis.isSuccess && <div role="status" className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Analysis complete. {analysis.data.createdCount} new {analysis.data.createdCount === 1 ? "opportunity" : "opportunities"} detected.</div>}
    {analysis.isError && <div role="alert" className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="h-4 w-4" />Unable to analyze payments. Please try again.</div>}
    <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4"><label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">Status<select value={status} onChange={(event) => updateFilter("status", event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"><option value="">All statuses</option>{(["open", "in_review", "accepted", "dismissed", "expired"] as OpportunityStatus[]).map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">Severity<select value={severity} onChange={(event) => updateFilter("severity", event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"><option value="">All severities</option>{(["high", "medium", "low", "critical"] as OpportunitySeverity[]).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label><label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">Type<select value={type} onChange={(event) => updateFilter("type", event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"><option value="">All types</option>{(["upi_evening_failure", "mobile_card_failure", "customer_retry_behavior", "other"] as OpportunityType[]).map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label></div>
    {opportunities.isLoading && <div className="overflow-hidden rounded-lg border bg-card p-5"><div className="space-y-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="flex gap-5"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-28" /></div>)}</div></div>}
    {opportunities.isError && <ErrorState message="Unable to load revenue opportunities. Please try again." />}
    {opportunities.data && <OpportunityTable items={opportunities.data.items} />}
  </div></ContentContainer>;
}
