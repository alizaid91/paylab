"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ContentContainer } from "@/components/layout/content-container";
import { Button } from "@/components/ui/button";
import {
  getStrategy,
  getStrategySimulations,
  getExecutions,
  runAdvisoryReview,
  runPolicyCheck,
  type AdvisoryReview,
  type PolicyCheckResult,
  type Strategy,
  type Simulation,
} from "@/lib/opportunities-api";

const title = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const display = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${title(key)}: ${display(item)}`)
      .join(", ");
  return String(value ?? "Not provided");
};

function Badge({
  children,
  className,
}: Readonly<{ children: ReactNode; className: string }>) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function StepIndicator({ completedSteps }: { completedSteps: boolean[] }) {
  const steps = [
    "Strategy",
    "Simulation",
    "Advisory",
    "Policy",
    "Approval",
    "Execution",
  ];
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((step, index) => (
        <li
          key={step}
          className={`rounded-lg border p-3 text-center text-xs font-medium ${
            completedSteps[index]
              ? "border-accent bg-accent/5 text-accent"
              : "text-muted-foreground"
          }`}
        >
          {completedSteps[index] ? (
            <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden="true" />
          ) : (
            <span className="mr-1">{index + 1}.</span>
          )}
          {step}
        </li>
      ))}
    </ol>
  );
}

function List({ items, empty }: { items?: string[]; empty: string }) {
  return items?.length ? (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
  );
}

function AdvisoryResult({ review }: { review: AdvisoryReview }) {
  const assessment = review.riskAssessment ?? {};
  const decisionClass =
    review.recommendation === "APPROVE"
      ? "bg-emerald-50 text-emerald-700"
      : review.recommendation === "REJECT"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Decision</p>
          <div className="mt-3">
            <Badge className={decisionClass}>{review.recommendation}</Badge>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Confidence</p>
          <p className="mt-2 text-2xl font-semibold">
            {Number(assessment.confidence ?? 0).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Risk level</p>
          <p className="mt-2 text-2xl font-semibold capitalize">
            {assessment.riskLevel ?? "Not provided"}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold">Concerns</h3>
          <List items={assessment.concerns} empty="No concerns identified." />
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold">Recommendations</h3>
          <List
            items={review.rationale ? [review.rationale] : []}
            empty="No recommendations provided."
          />
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold">Assumption Issues</h3>
          <List
            items={assessment.assumptionIssues}
            empty="No assumption issues identified."
          />
        </div>
      </div>
    </div>
  );
}

function PolicyResult({ result }: { result: PolicyCheckResult }) {
  const rules = result.failedRules;
  return (
    <div className="mt-6 space-y-4">
      {result.passed ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
          <div>
            <p className="font-semibold">Policy Status: PASSED</p>
            <p className="text-sm">All evaluated safety rules passed.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-700">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Policy Status: FAILED</p>
            <p className="text-sm">
              Approval is blocked until the failed rules are addressed.
            </p>
          </div>
        </div>
      )}
      {rules.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="sr-only">Failed policy rules</caption>
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Rule</th>
                <th className="px-5 py-3 font-medium">Configured limit</th>
                <th className="px-5 py-3 font-medium">Strategy value</th>
                <th className="px-5 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule, index) => (
                <tr key={`${String(rule.rule)}-${index}`}>
                  <th className="px-5 py-4 font-medium">
                    {title(String(rule.rule ?? "Unknown rule"))}
                  </th>
                  <td className="px-5 py-4">
                    {display(rule.limit ?? rule.allowed ?? rule.required)}
                  </td>
                  <td className="px-5 py-4">
                    {display(rule.actual ?? rule.status)}
                  </td>
                  <td className="px-5 py-4">
                    <Badge className="bg-rose-50 text-rose-700">FAILED</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">Warnings</p>
          <List
            items={result.warnings.map((warning) =>
              display(warning.message ?? warning),
            )}
            empty=""
          />
        </div>
      )}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold">Evaluated values</h3>
        {Object.keys(result.evaluatedValues).length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(result.evaluatedValues).map(([key, value]) => (
              <div key={key} className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{title(key)}</p>
                <p className="mt-1 text-sm font-medium">{display(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No evaluated values were returned for this policy check.
          </p>
        )}
      </div>
    </div>
  );
}

function fallbackEvaluatedValues(
  strategy: Strategy,
  simulation: Simulation | undefined,
  advisory: AdvisoryReview | null,
) {
  const output = simulation?.output;
  const total = Number(output?.totalTransactions ?? 0);
  const affected = Number(output?.affectedTransactions ?? 0);
  const currentRevenue = Number(output?.currentRevenue ?? 0);
  const recovery = Number(output?.potentialRevenueRecovery ?? 0);
  return {
    affectedTransactionPercentage:
      total > 0 ? Number(((affected / total) * 100).toFixed(2)) : 0,
    revenueExposurePercentage:
      currentRevenue > 0
        ? Number(((recovery / currentRevenue) * 100).toFixed(2))
        : 0,
    paymentMethod: "all",
    executionHour: 12,
    dailyExecutionAmount: String(output?.potentialRevenueRecovery ?? "0"),
    strategyConfidence: Number(strategy.configuration.confidence ?? 0),
    simulationConfidence: Number(output?.confidence ?? 0),
    advisoryDecision: advisory?.recommendation ?? "Not available",
  };
}

export default function AdvisoryPolicyReviewContent({ id }: { id: string }) {
  const strategy = useQuery({
    queryKey: ["strategies", id],
    queryFn: () => getStrategy(id),
  });
  const simulations = useQuery({
    queryKey: ["strategies", id, "simulations"],
    queryFn: () => getStrategySimulations(id),
  });
  const executions = useQuery({
    queryKey: ["executions"],
    queryFn: getExecutions,
  });
  const [advisory, setAdvisory] = useState<AdvisoryReview | null>(null);
  const [policy, setPolicy] = useState<PolicyCheckResult | null>(null);
  const [selectedSimulationId, setSelectedSimulationId] = useState("");
  const completedSimulations = (simulations.data ?? []).filter(
    (simulation) => simulation.status === "completed",
  );
  useEffect(() => {
    if (!selectedSimulationId && completedSimulations[0]) {
      setSelectedSimulationId(completedSimulations[0].id);
    }
  }, [completedSimulations, selectedSimulationId]);
  useEffect(() => {
    if (strategy.data?.advisoryReview) {
      setAdvisory(strategy.data.advisoryReview);
    }
    if (strategy.data?.policyCheck) {
      const completedSimulation = (simulations.data ?? []).find(
        (simulation) => simulation.status === "completed",
      );
      setPolicy({
        passed: strategy.data.policyCheck.status === "passed",
        failedRules: strategy.data.policyCheck.reasons,
        warnings: [],
        evaluatedValues:
          strategy.data.policyCheck.evaluatedValues ??
          fallbackEvaluatedValues(
            strategy.data,
            completedSimulation,
            strategy.data.advisoryReview,
          ),
        evaluatedAt: strategy.data.policyCheck.evaluatedAt,
        policyResult: {
          id: strategy.data.policyCheck.id,
          status: strategy.data.policyCheck.status,
          decision: strategy.data.policyCheck.decision,
        },
      });
    }
  }, [strategy.data, simulations.data]);
  const advisoryMutation = useMutation({
    mutationFn: () => runAdvisoryReview(id, selectedSimulationId),
    onSuccess: (result) => {
      setAdvisory(result);
      setPolicy(null);
    },
  });
  const policyMutation = useMutation({
    mutationFn: () => runPolicyCheck(id),
    onSuccess: setPolicy,
  });
  const canCheckPolicy = advisory !== null;
  const canApprove = Boolean(
    policy?.passed && advisory?.recommendation === "APPROVE",
  );
  const strategyStatus = strategy.data?.status;
  const simulationComplete =
    completedSimulations.length > 0 ||
    ["simulated", "reviewed", "policy_approved", "merchant_approved", "executing", "completed"].includes(
      strategyStatus ?? "",
    );
  const approvalComplete = [
    "merchant_approved",
    "executing",
    "completed",
  ].includes(strategyStatus ?? "");
  const executionComplete = strategyStatus === "completed";
  const completedSteps = [
    Boolean(strategy.data),
    simulationComplete,
    Boolean(advisory),
    Boolean(policy),
    approvalComplete,
    executionComplete,
  ];
  const execution = executions.data?.find(
    (item) => item.execution.strategyId === id,
  );
  const isExecuted =
    strategyStatus === "completed" || Boolean(execution);
  return (
    <ContentContainer>
      <div className="border-b pb-6">
        <Link
          href={`/strategies/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to strategy
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-accent">
          Safety workflow
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Strategy Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validate the recommendation before execution.
        </p>
      </div>
      <div className="mt-8">
        <StepIndicator completedSteps={completedSteps} />
      </div>
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Advisory Review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The Advisory Agent challenges the original recommendation before
            policy validation.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5 mb-3">
          <p className="text-sm font-medium">Simulation used for this review</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {completedSimulations[0]
              ? `Completed ${new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(completedSimulations[0].createdAt))}`
              : "Run the strategy simulation before starting advisory review."}
          </p>
          {simulations.isError && (
            <p className="mt-2 text-sm text-destructive">
              Unable to load simulations for this strategy.
            </p>
          )}
        </div>
        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="rounded-lg border bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Strategy Recommendation
            </p>
            <p className="mt-2 font-semibold">{strategy.data?.name ?? "Original strategy"}</p>
          </div>
          <ArrowDown className="mx-auto h-5 w-5 text-accent md:hidden" />
          <ArrowDown className="hidden h-5 w-5 rotate-[-90deg] text-accent md:block" />
          <div className="rounded-lg border-2 border-accent bg-accent/5 p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-accent">
              Advisory Agent
            </p>
            <p className="mt-2 font-semibold">Independent challenge</p>
          </div>
          <ArrowDown className="mx-auto h-5 w-5 text-accent md:hidden" />
          <ArrowDown className="hidden h-5 w-5 rotate-[-90deg] text-accent md:block" />
          <div className="rounded-lg border bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Assessment
            </p>
            <p className="mt-2 font-semibold">
              {advisory ? "Review complete" : "Awaiting review"}
            </p>
          </div>
        </div>
        <Button
          className="mt-6"
          onClick={() => advisoryMutation.mutate()}
          disabled={!selectedSimulationId || Boolean(advisory) || advisoryMutation.isPending}
        >
          {advisoryMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {advisoryMutation.isPending
            ? "Running advisory review..."
            : "Run Advisory Review"}
        </Button>
        {advisory && (
          <p className="mt-3 text-sm text-emerald-700">
            Advisory review already exists. This step is locked.
          </p>
        )}
        {advisoryMutation.isError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            Unable to run advisory review. Complete a simulation first, then try
            again.
          </div>
        )}
        {advisory && <AdvisoryResult review={advisory} />}
      </section>
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Policy Check</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Policy validation is available only after an advisory review exists.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => policyMutation.mutate()}
          disabled={!canCheckPolicy || Boolean(policy) || policyMutation.isPending}
        >
          {policyMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {policyMutation.isPending
            ? "Running policy check..."
            : "Run Policy Check"}
        </Button>
        {!canCheckPolicy && (
          <p className="mt-3 text-sm text-muted-foreground">
            Run the Advisory Review before checking policy.
          </p>
        )}
        {policy && (
          <p className="mt-3 text-sm text-emerald-700">
            Policy check already exists. This step is locked.
          </p>
        )}
        {policyMutation.isError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            Unable to run policy check. The backend requires a completed
            simulation and advisory review.
          </div>
        )}
        {policy && <PolicyResult result={policy} />}
      </section>
      {!isExecuted && (
        <section className="mt-10 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Next Action</h2>
          {!advisory || !policy ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Complete both safety reviews to determine whether this strategy is
              ready for approval.
            </p>
          ) : !canApprove ? (
            <div className="mt-3 flex items-start gap-2 text-sm text-rose-700">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Approval is blocked because the advisory decision is{" "}
                {advisory.recommendation} or the policy check failed.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <p className="font-semibold">Ready for Merchant Approval</p>
              </div>
              <Button className="mt-5" asChild>
                <Link href={`/strategies/${id}/execute`}>
                  Review &amp; Approve
                </Link>
              </Button>
            </div>
          )}
        </section>
      )}
      {isExecuted && (
        <section className="mt-10 rounded-lg border border-accent/20 bg-accent/5 p-6">
          <h2 className="text-lg font-semibold">Execution Result</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {execution
              ? "This strategy has been executed. View the backend execution result and audit timeline."
              : "This strategy is marked as executed. Loading its backend execution result..."}
          </p>
          {execution && (
            <Button className="mt-5 bg-black text-white">
              <Link href={`/executions/${execution.execution.id}`}>
                View Execution Result
              </Link>
            </Button>
          )}
        </section>
      )}
    </ContentContainer>
  );
}
