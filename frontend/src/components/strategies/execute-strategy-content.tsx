"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { approveStrategy, executeStrategy, getStrategy, getStrategySimulations, type Execution } from "@/lib/opportunities-api";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (value: unknown) => currency.format(Number(value) || 0);
const percent = (value: unknown) => `${Number(value || 0).toFixed(2)}%`;
const title = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function SummaryCard({ heading, children }: Readonly<{ heading: string; children: React.ReactNode }>) {
  return <div className="rounded-lg border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</p><div className="mt-2 text-sm leading-6">{children}</div></div>;
}

function ExecuteContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [approved, setApproved] = useState(false);
  const strategy = useQuery({ queryKey: ["strategies", id], queryFn: () => getStrategy(id) });
  const simulations = useQuery({ queryKey: ["strategies", id, "simulations"], queryFn: () => getStrategySimulations(id) });
  const approval = useMutation({ mutationFn: () => approveStrategy(id), onSuccess: () => { setApproved(true); queryClient.invalidateQueries({ queryKey: ["strategies", id] }); } });
  const execution = useMutation({ mutationFn: () => executeStrategy(id) });
  const configuration = (strategy.data?.configuration ?? {}) as Record<string, unknown>;
  const impact = (configuration.expectedImpact ?? {}) as Record<string, unknown>;
  const simulation = simulations.data?.find((item) => item.status === "completed");
  const output = simulation?.output;
  const isApproved = approved || strategy.data?.status === "merchant_approved";
  const canApprove = strategy.data?.status === "policy_approved";
  const execute = () => {
    if (window.confirm("Are you sure you want to execute this strategy?")) execution.mutate();
  };

  if (strategy.isLoading || simulations.isLoading) return <ContentContainer><div className="h-96 animate-pulse rounded-lg bg-muted" /></ContentContainer>;
  if (strategy.isError || simulations.isError || !strategy.data) return <ContentContainer><ErrorState message="Unable to load the strategy execution review." /></ContentContainer>;

  return <ContentContainer><div className="border-b pb-6"><Link href={`/strategies/${id}/review`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to safety review</Link><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-accent">Merchant approval</p><h1 className="mt-2 text-2xl font-semibold">Approve Strategy</h1><p className="mt-1 text-sm text-muted-foreground">{strategy.data.name} · Simulated execution in the PAYLAB MVP</p></div><section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">Final Review</h2><p className="mt-1 text-sm text-muted-foreground">Confirm the recommendation and safety checks before execution.</p></div><div className="grid gap-4 lg:grid-cols-2"><SummaryCard heading="Problem"><p>{strategy.data.opportunity?.name ?? "Source opportunity"} created this strategy.</p></SummaryCard><SummaryCard heading="Recommendation"><p>{String(configuration.objective ?? "Strategy recommendation")}</p></SummaryCard><SummaryCard heading="Expected Impact"><p>Revenue recovery: <strong>{money(String(impact.estimatedRevenueRecovery ?? "0"))}</strong></p><p>Projected success rate: <strong>{output ? percent(output.projectedSuccessRate) : "Not available"}</strong></p></SummaryCard><SummaryCard heading="Risk"><p className="capitalize">{output?.riskLevel ? String(output.riskLevel) : "Not available"}</p></SummaryCard><SummaryCard heading="Policy Result"><p className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="h-4 w-4" />{canApprove || isApproved ? "PASSED" : "Pending policy approval"}</p></SummaryCard><SummaryCard heading="Advisory Result"><p className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="h-4 w-4" />{canApprove || isApproved ? "APPROVED" : "Pending advisory approval"}</p></SummaryCard></div></section><section className="mt-8 rounded-lg border bg-card p-6"><h2 className="text-lg font-semibold">Merchant Approval</h2><p className="mt-1 text-sm text-muted-foreground">Approval is validated by the backend against the advisory and policy results.</p>{!isApproved ? <Button className="mt-5" onClick={() => { if (window.confirm("Are you sure you want to approve this strategy?")) approval.mutate(); }} disabled={!canApprove || approval.isPending}>{approval.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{approval.isPending ? "Approving strategy..." : "Approve Strategy"}</Button> : <div className="mt-5 flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /><span className="font-semibold">Strategy approved</span></div>}{approval.isError && <div role="alert" className="mt-4 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />Unable to approve this strategy. Confirm that policy and advisory checks have passed.</div>}</section>{isApproved && <section className="mt-8 rounded-lg border border-accent/20 bg-accent/5 p-6"><h2 className="text-lg font-semibold">Execute Strategy</h2><p className="mt-1 text-sm text-muted-foreground">Execution is simulated in the MVP and will use the approved strategy.</p><Button className="mt-5" onClick={execute} disabled={execution.isPending || execution.isSuccess}>{execution.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{execution.isPending ? "Executing..." : execution.isSuccess ? "Execution completed" : "Execute"}</Button>{execution.isError && <div role="alert" className="mt-4 flex items-center gap-2 text-sm text-destructive"><ShieldAlert className="h-4 w-4" />Unable to execute this strategy. Please verify merchant approval and policy status.</div>}{execution.data && <ExecutionSummary execution={execution.data.execution} result={execution.data.result} />}</section>}</ContentContainer>;
}

function ExecutionSummary({ execution, result }: { execution: Execution; result: Execution["result"] }) {
  return <div className="mt-6 space-y-5"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-5 w-5" /><p className="font-semibold">Execution Status: {title(execution.status)}</p></div><div className="grid gap-4 sm:grid-cols-3"><SummaryCard heading="Transactions Affected"><strong>{execution.affectedTransactionCount.toLocaleString("en-IN")}</strong></SummaryCard><SummaryCard heading="Expected Recovery"><strong>{money(execution.expectedRecovery)}</strong></SummaryCard><SummaryCard heading="Actual Simulated Recovery"><strong className="text-accent">{money(result?.actualRecovery)}</strong></SummaryCard></div><Button asChild variant="outline"><Link href={`/executions/${execution.id}`}><Play className="mr-2 h-4 w-4" />View Execution Details</Link></Button></div>;
}

export default function ExecuteStrategyContent({ id }: { id: string }) {
  return <ExecuteContent id={id} />;
}
