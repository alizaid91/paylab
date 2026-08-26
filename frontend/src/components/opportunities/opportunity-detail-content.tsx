"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { generateOpportunityStrategy, getOpportunity, type Opportunity, type OpportunitySeverity, type OpportunityStatus } from "@/lib/opportunities-api";

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
  return <Badge className={severity === "high" || severity === "critical" ? "bg-rose-50 text-rose-700" : severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}>{severity.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: OpportunityStatus }) {
  return <Badge className={status === "open" ? "bg-blue-50 text-blue-700" : status === "in_review" ? "bg-violet-50 text-violet-700" : status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}>{label(status)}</Badge>;
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "Not provided");
}

function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence);
  if (!entries.length) return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No structured evidence was returned.</div>;
  return <div className="grid gap-3 sm:grid-cols-2">{entries.map(([key, value]) => <div key={key} className="rounded-lg border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label(key)}</p>{typeof value === "object" && value !== null ? <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm">{displayValue(value)}</pre> : <p className="mt-2 text-sm font-medium">{displayValue(value)}</p>}</div>)}</div>;
}

function Detail({ data, id }: { data: Opportunity; id: string }) {
  const router = useRouter();
  const strategy = useMutation({ mutationFn: () => generateOpportunityStrategy(id), onSuccess: (result) => { sessionStorage.setItem(`paylab_strategy_${result.id}`, JSON.stringify(result)); router.push(`/strategies/${result.id}`); } });
  return <><PageHeader title={data.title} description={`${label(data.type)} opportunity`} actions={<div className="flex items-center gap-2"><StatusBadge status={data.status} /><SeverityBadge severity={data.severity} /></div>} /><div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">Opportunity value</p><p className="mt-2 text-2xl font-semibold">{money(data.estimatedOpportunityValue)}</p></div><div className="rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">Confidence</p><p className="mt-2 text-2xl font-semibold">{Number(data.confidence).toFixed(2)}%</p></div><div className="rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">Status</p><div className="mt-3"><StatusBadge status={data.status} /></div></div></div><section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">Problem</h2><p className="mt-1 text-sm text-muted-foreground">Why PAYLAB detected this opportunity.</p></div><div className="rounded-lg border bg-card p-5"><p className="text-sm leading-6">{data.description}</p><div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Affected transactions</p><p className="mt-1 font-semibold">{data.affectedTransactionCount.toLocaleString("en-IN")}</p></div><div><p className="text-xs text-muted-foreground">Affected payment value</p><p className="mt-1 font-semibold">{money(data.affectedPaymentValue)}</p></div><div><p className="text-xs text-muted-foreground">Detection time</p><p className="mt-1 font-semibold">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.detectedAt))}</p></div></div></div></section><section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">Evidence</h2><p className="mt-1 text-sm text-muted-foreground">Structured payment data used to identify this opportunity.</p></div><Evidence evidence={data.evidence} /></section><section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">Why It Matters</h2></div><div className="rounded-lg border border-accent/20 bg-accent/5 p-6"><p className="text-sm font-medium text-muted-foreground">Potential Revenue Impact</p><p className="mt-2 text-3xl font-semibold text-accent">{money(data.estimatedOpportunityValue)}</p><p className="mt-2 text-sm text-muted-foreground">Estimated recoverable revenue returned by PAYLAB.</p></div></section><section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">Generate Strategy</h2><p className="mt-1 text-sm text-muted-foreground">Create a structured strategy for review based on this opportunity.</p></div><div className="rounded-lg border bg-card p-5"><Button onClick={() => strategy.mutate()} disabled={strategy.isPending}>{strategy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{strategy.isPending ? "Generating strategy..." : "Generate AI Strategy"}</Button>{strategy.isError && <div role="alert" className="mt-4 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />Unable to generate a strategy. Please try again.</div>}{strategy.isSuccess && <div role="status" className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Strategy generated. Opening review...</div>}</div></section></>;
}

export function OpportunityDetailContent({ id }: { id: string }) {
  const opportunity = useQuery({ queryKey: ["opportunities", id], queryFn: () => getOpportunity(id) });
  return <ContentContainer><div className="mb-6"><Link href="/opportunities" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to opportunities</Link></div>{opportunity.isLoading && <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-48" /><Skeleton className="h-64" /></div>}{opportunity.isError && <ErrorState message="Unable to load this opportunity. Please try again." />}{opportunity.data && <Detail data={opportunity.data} id={id} />}</ContentContainer>;
}
