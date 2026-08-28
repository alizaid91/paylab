"use client";

import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import {
  generateOpportunityStrategy,
  getOpportunity,
  type Opportunity,
  type OpportunitySeverity,
  type OpportunityStatus,
} from "@/lib/opportunities-api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const money = (value: unknown) => currency.format(Number(value) || 0);
const label = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const percent = (value: unknown) => `${Number(value || 0).toFixed(2)}%`;

const truncate = (text: string, maxLength = 20) =>
  text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function Badge({
  children,
  className,
}: Readonly<{ children: ReactNode; className: string }>) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: OpportunitySeverity }) {
  const className =
    severity === "high" || severity === "critical"
      ? "bg-rose-50 text-rose-700"
      : severity === "medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
  return <Badge className={className}>{severity.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: OpportunityStatus }) {
  const className =
    status === "open"
      ? "bg-blue-50 text-blue-700"
      : status === "in_review"
        ? "bg-violet-50 text-violet-700"
        : status === "accepted"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-700";
  return <Badge className={className}>{label(status)}</Badge>;
}

function formatTimeWindow(value: unknown) {
  if (typeof value !== "string" || !value.includes("-"))
    return String(value ?? "Not provided");
  const [start, end] = value.split("-");
  const format = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
    const suffix = hours >= 12 ? "PM" : "AM";
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
  };
  return `${format(start)} – ${format(end)}`;
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "Not provided");
}

function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence);
  const hasRates =
    "failureRate" in evidence || "baselineFailureRate" in evidence;
  const currentRate = Number(evidence.failureRate);
  const baselineRate = Number(evidence.baselineFailureRate);
  const maxRate = Math.max(currentRate, baselineRate, 1);

  if (!entries.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No structured evidence was returned.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasRates && (
        <div className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
          {[
            ["Current failure rate", currentRate],
            ["Baseline failure rate", baselineRate],
          ].map(([name, value]) => (
            <div key={String(name)}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{name}</p>
                <p className="font-semibold">{percent(value)}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{
                    width: `${Math.min((Number(value) / maxRate) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[480px] text-left text-sm">
          <caption className="sr-only">Opportunity evidence</caption>
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Signal</th>
              <th className="px-5 py-3 font-medium">Observed value</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map(([key, value]) => (
              <tr key={key}>
                <th scope="row" className="px-5 py-3 font-medium">
                  {label(key)}
                </th>
                <td className="whitespace-pre-wrap px-5 py-3 text-muted-foreground">
                  {key === "failureRate" || key === "baselineFailureRate"
                    ? percent(value)
                    : key === "timeWindow"
                      ? formatTimeWindow(value)
                      : displayValue(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ data, id }: { data: Opportunity; id: string }) {
  const router = useRouter();
  const strategy = useMutation({
    mutationFn: () => generateOpportunityStrategy(id),
    onSuccess: (result) => router.push(`/strategies/${result.id}`),
  });

  return (
    <>
      <PageHeader
        eyebrow="Revenue opportunity"
        title={data.title}
        description={`${label(data.type)} detected by PAYLAB`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} />
            <SeverityBadge severity={data.severity} />
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Opportunity value</p>
          <p className="mt-2 text-2xl font-semibold">
            {money(data.estimatedOpportunityValue)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Confidence</p>
          <p className="mt-2 text-2xl font-semibold">
            {percent(data.confidence)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Severity</p>
          <div className="mt-3">
            <SeverityBadge severity={data.severity} />
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Problem</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Why PAYLAB detected this opportunity.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm leading-6">{data.description}</p>
          <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Affected transactions
              </p>
              <p className="mt-1 font-semibold">
                {data.affectedTransactionCount.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Affected payment value
              </p>
              <p className="mt-1 font-semibold">
                {money(data.affectedPaymentValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Detection time</p>
              <p className="mt-1 font-semibold">
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(data.detectedAt))}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Evidence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The structured payment signals behind this detection.
          </p>
        </div>
        <Evidence evidence={data.evidence} />
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Why It Matters</h2>
        </div>
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Potential Revenue Impact
          </p>
          <p className="mt-2 text-3xl font-semibold text-accent">
            {money(data.estimatedOpportunityValue)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimated recoverable revenue returned by PAYLAB.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Related Strategies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Strategies generated from this opportunity.
          </p>
        </div>
        {data.strategies.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No strategies have been generated yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">
                Strategies generated from this opportunity
              </caption>
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Strategy</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Version</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.strategies.map((relatedStrategy) => (
                  <tr key={relatedStrategy.id} className="hover:bg-muted/30">
                    <th scope="row" className="px-5 py-4 font-medium">
                      {truncate(relatedStrategy.name, 20)}
                    </th>
                    <td className="px-5 py-4">{label(relatedStrategy.type)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">
                        {label(relatedStrategy.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">v{relatedStrategy.version}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(relatedStrategy.createdAt))}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/strategies/${relatedStrategy.id}`}>
                          View strategy
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Generate Strategy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a structured strategy for review based on this opportunity.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <Button
            onClick={() => strategy.mutate()}
            disabled={strategy.isPending}
          >
            {strategy.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {strategy.isPending
              ? "Generating strategy..."
              : "Generate AI Strategy"}
          </Button>
          {strategy.isError && (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4" />
              Unable to generate a strategy. Please try again.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function OpportunityDetailContent({ id }: { id: string }) {
  const opportunity = useQuery({
    queryKey: ["opportunities", id],
    queryFn: () => getOpportunity(id),
  });
  return (
    <ContentContainer>
      <div className="mb-6">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to opportunities
        </Link>
      </div>
      {opportunity.isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-12 w-2/3" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      )}
      {opportunity.isError && (
        <ErrorState message="Unable to load this opportunity. Please try again." />
      )}
      {opportunity.data && <Detail data={opportunity.data} id={id} />}
    </ContentContainer>
  );
}
