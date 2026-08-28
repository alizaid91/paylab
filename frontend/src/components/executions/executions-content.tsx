"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { getExecutions, type Execution } from "@/lib/opportunities-api";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const money = (value: unknown) => currency.format(Number(value) || 0);
const title = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function StatusBadge({ status }: { status: string }) {
  const className = status === "completed" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-rose-50 text-rose-700" : status === "running" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${className}`}>{title(status)}</span>;
}

export default function ExecutionsContent() {
  const executions = useQuery({ queryKey: ["executions"], queryFn: getExecutions });
  if (executions.isLoading) return <ContentContainer><div className="h-64 animate-pulse rounded-lg bg-muted" /></ContentContainer>;
  if (executions.isError) return <ContentContainer><ErrorState message="Unable to load executions." /></ContentContainer>;
  const items = executions.data ?? [];
  return <ContentContainer><div className="border-b pb-6"><p className="text-xs font-semibold uppercase tracking-wider text-accent">Operations</p><h1 className="mt-2 text-2xl font-semibold">Executions</h1><p className="mt-1 text-sm text-muted-foreground">Simulated strategy executions and their outcomes.</p></div>{!items.length ? <div className="mt-8 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No executions have been recorded yet.</div> : <div className="mt-8 overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[1100px] text-left text-sm"><caption className="sr-only">Strategy executions</caption><thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Execution ID</th><th className="px-5 py-3 font-medium">Strategy</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Transactions Affected</th><th className="px-5 py-3 font-medium">Expected Recovery</th><th className="px-5 py-3 font-medium">Actual Recovery</th><th className="px-5 py-3 font-medium">Started At</th><th className="px-5 py-3 font-medium">Completed At</th><th aria-hidden="true" /></tr></thead><tbody className="divide-y">{items.map(({ execution, result, strategy }) => <ExecutionRow key={execution.id} execution={execution} result={result} strategyName={strategy?.name} />)}</tbody></table></div>}</ContentContainer>;
}

function ExecutionRow({ execution, result, strategyName }: { execution: Execution; result: Execution["result"]; strategyName?: string }) {
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  return <tr className="hover:bg-muted/30"><th className="px-5 py-4 font-mono text-xs font-medium"><Link href={`/executions/${execution.id}`} className="hover:text-accent">{execution.id}</Link></th><td className="px-5 py-4 font-medium">{strategyName ?? execution.strategyId}</td><td className="px-5 py-4"><StatusBadge status={execution.status} /></td><td className="px-5 py-4">{execution.affectedTransactionCount.toLocaleString("en-IN")}</td><td className="px-5 py-4">{money(execution.expectedRecovery)}</td><td className="px-5 py-4">{money(result?.actualRecovery)}</td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(execution.startedAt)}</td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(execution.completedAt)}</td><td className="px-5 py-4"><Link href={`/executions/${execution.id}`} aria-label={`View execution ${execution.id}`}><ArrowRight className="h-4 w-4 text-muted-foreground hover:text-foreground" /></Link></td></tr>;
}
