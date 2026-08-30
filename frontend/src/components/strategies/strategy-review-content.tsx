"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import {
  getStrategy,
  getStrategySimulations,
  getExecutions,
  simulateStrategy,
  type Simulation,
  type Strategy,
} from "@/lib/opportunities-api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const money = (value: string | number) => currency.format(Number(value) || 0);
const percent = (value: number) => `${Number(value || 0).toFixed(2)}%`;
const title = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const normalized = word.toLowerCase();
      if (["upi", "ist", "ms", "api"].includes(normalized)) {
        return normalized.toUpperCase();
      }
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
const formatValue = (key: string, value: unknown): string => {
  if (Array.isArray(value))
    return value.map((item) => formatValue(key, item)).join(", ");
  if (value && typeof value === "object") return readableValue(value);
  if (typeof value === "number") {
    if (key.toLowerCase().endsWith("ms"))
      return `${value.toLocaleString("en-IN")} ms`;
    return value.toLocaleString("en-IN");
  }
  const text = String(value ?? "Not provided");
  return /[_-]/.test(text) || text === text.toUpperCase() ? title(text) : text;
};
const readableValue = (value: unknown): string => {
  if (Array.isArray(value))
    return value.map((item) => formatValue("", item)).join(", ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${title(key)}: ${formatValue(key, item)}`)
      .join(", ");
  return formatValue("", value);
};
const readableParameters = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value)
    : [];

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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={
        status === "completed"
          ? "bg-emerald-50 text-emerald-700"
          : status === "failed"
            ? "bg-rose-50 text-rose-700"
            : status === "queued" || status === "running"
              ? "bg-amber-50 text-amber-700"
              : status === "simulated"
                ? "bg-violet-50 text-violet-700"
                : status === "generated"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-700"
      }
    >
      {title(status)}
    </Badge>
  );
}

function Card({
  heading,
  children,
}: Readonly<{ heading: string; children: React.ReactNode }>) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h3 className="font-semibold">{heading}</h3>
      {children}
    </section>
  );
}

function StrategyContent({ strategy, id }: { strategy: Strategy; id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const simulations = useQuery({
    queryKey: ["strategies", id, "simulations"],
    queryFn: () => getStrategySimulations(id),
  });
  const executions = useQuery({
    queryKey: ["executions"],
    queryFn: getExecutions,
  });
  const simulation = useMutation({
    mutationFn: () => simulateStrategy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["strategies", id, "simulations"],
      });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
    },
  });
  const configuration = (strategy.configuration ?? {}) as Record<
    string,
    unknown
  >;
  const expectedImpact = (configuration.expectedImpact ?? {}) as Record<
    string,
    unknown
  >;
  const trigger = (configuration.trigger ?? {}) as Record<string, unknown>;
  const actions = Array.isArray(configuration.actions)
    ? configuration.actions.filter(Boolean)
    : [];
  const assumptions = Array.isArray(configuration.assumptions)
    ? configuration.assumptions.filter(Boolean)
    : [];
  const risks = Array.isArray(configuration.risks)
    ? configuration.risks.filter(Boolean)
    : [];
  const completedSimulation = simulations.data?.find(
    (item) => item.status === "completed",
  );
  const displaySimulation =
    strategy.status === "simulated"
      ? completedSimulation
      : (simulation.data ?? completedSimulation);
  const simulationOutput = displaySimulation?.output;
  const execution = executions.data?.find(
    (item) => item.execution.strategyId === id,
  );

  const opportunityName = strategy.opportunity?.name ?? "Opportunity";
  const objective = String(configuration.objective ?? "No objective provided.");
  const targetSegment = String(
    configuration.targetSegment ?? "No target segment provided.",
  );
  const triggerConditions = Array.isArray(trigger.conditions)
    ? trigger.conditions
    : [];
  const revenueRecoveryPct = Number(
    expectedImpact.revenueRecoveryPercentage ?? 0,
  );
  const successLiftPct = Number(expectedImpact.successRateLiftPercentage ?? 0);
  const estimatedRecovery = money(
    String(expectedImpact.estimatedRevenueRecovery ?? "0"),
  );
  const affectedTransactions =
    strategy.opportunity?.affectedTransactionCount ?? 0;
  const affectedValue =
    strategy.opportunity?.estimatedOpportunityValue ??
    String(expectedImpact.estimatedRevenueRecovery ?? "0");
  const confidence = Number(configuration.confidence ?? 0);
  const primaryActionLabel =
    strategy.status === "generated" ? "Simulate Impact" : "View Simulation";

  const handlePrimaryAction = () => {
    if (strategy.status === "generated") {
      simulation.mutate();
      return;
    }

    document.getElementById("simulation")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const showSimulation = Boolean(displaySimulation?.output);
  const reviewEnabled = Boolean(showSimulation && displaySimulation);

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Link
            href={`/opportunities/${strategy.opportunity?.id ?? ""}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to opportunity
          </Link>
          <StatusBadge status={strategy.status} />
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Strategy detail
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {strategy.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link
                href={`/opportunities/${strategy.opportunity?.id ?? ""}`}
                className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 font-medium text-foreground hover:border-accent/40"
              >
                {opportunityName}
              </Link>
              <span>•</span>
              <span>
                Created{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(strategy.createdAt))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="lg"
              onClick={handlePrimaryAction}
              disabled={strategy.status === "generated" && simulation.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {strategy.status === "generated" && simulation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running simulation...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {primaryActionLabel}
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                if (reviewEnabled) {
                  router.push(`/strategies/${id}/review`);
                }
              }}
              disabled={!reviewEnabled}
            >
              Review & Execute
            </Button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Objective
            </p>
          </div>
        </div>

        <p className="max-w-3xl text-base text-muted-foreground">{objective}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Revenue Recovery
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            {percent(revenueRecoveryPct)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimated percentage of the affected payment value this strategy
            could recover.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Success Rate Lift
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            +{percent(successLiftPct)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Strategy estimate for the expected improvement in successful payment
            completion.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Estimated Revenue Recovery
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            {estimatedRecovery}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimated upside based on the current affected transaction value.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Why this strategy?</h2>
            <Badge className="bg-violet-50 text-violet-700">
              Evidence-based
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Problem detected
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {opportunityName}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Affected transactions
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {affectedTransactions.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Affected payment value
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {money(affectedValue)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Confidence
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {percent(confidence)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-dashed bg-background/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Detected pattern
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {triggerConditions.length > 0
                ? triggerConditions[0]
                : "The opportunity was detected from transaction behavior and customer payment flow data."}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Strategy summary</h2>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Target segment
              </p>
              <p className="mt-2 text-foreground">{targetSegment}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Trigger type
              </p>
              <p className="mt-2 text-foreground">
                {title(String(trigger.type ?? "Not provided"))}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-foreground">{title(strategy.status)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Recovery plan</h2>
          <ol className="mt-5 space-y-4">
            {actions.length > 0 ? (
              actions.map((action, index) => {
                const actionObject =
                  typeof action === "object" && action !== null ? action : null;
                const actionName =
                  actionObject && "action" in actionObject
                    ? String(actionObject.action)
                    : formatValue("", action);
                const parameters =
                  actionObject && "parameters" in actionObject
                    ? (actionObject.parameters as Record<string, unknown>)
                    : {};

                return (
                  <li key={`${actionName}-${index}`} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                      {index + 1}
                    </span>
                    <div className="flex-1 rounded-xl border bg-muted/30 p-4">
                      <p className="font-semibold text-foreground">
                        {title(actionName)}
                      </p>
                      {parameters && Object.keys(parameters).length > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {Object.entries(parameters).map(([key, value]) => (
                            <div
                              key={key}
                              className="rounded-lg bg-background p-2.5"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {title(key)}
                              </p>
                              <p className="mt-1 text-sm text-foreground">
                                {formatValue(key, value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Apply the recommended recovery action to the affected
                          payment segment.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                No action steps were returned for this strategy.
              </li>
            )}
          </ol>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Trigger & target</h2>
          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Who/what is targeted
              </p>
              <p className="mt-2 text-foreground">{targetSegment}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                When it triggers
              </p>
              <p className="mt-2 text-foreground">
                {title(String(trigger.type ?? "Not provided"))}
              </p>
            </div>
            {triggerConditions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Conditions required
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {triggerConditions.map((condition) => (
                    <li key={String(condition)}>
                      {formatValue("", condition)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Assumptions</h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {assumptions.length > 0 ? (
              assumptions.map((item) => (
                <li key={String(item)}>{String(item)}</li>
              ))
            ) : (
              <li>No assumptions were provided for this strategy.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Risks</h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {risks.length > 0 ? (
              risks.map((item) => <li key={String(item)}>{String(item)}</li>)
            ) : (
              <li>No material risks were provided for this strategy.</li>
            )}
          </ul>
        </section>
      </div>

      <section
        id="simulation"
        className="rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Simulation
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Expected impact before execution
          </h2>
        </div>

        {simulation.isError ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              Simulation unavailable
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn&apos;t calculate the expected impact for this strategy.
              Please try running the simulation again.
            </p>
          </div>
        ) : showSimulation && displaySimulation ? (
          <div className="mt-6">
            <SimulationComparison simulation={displaySimulation} />
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed bg-muted/30 p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>

            <h3 className="mt-3 text-sm font-semibold">
              No simulation available yet
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Run a simulation to see the estimated financial impact of this
              strategy before you execute it.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Reasoning</h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {String(
            configuration.reasoning ??
              "No reasoning was provided for this strategy.",
          )}
        </p>
      </section>

      {execution && (
        <section className="rounded-2xl border border-accent/20 bg-accent/5 p-6">
          <h2 className="text-xl font-semibold">Execution status</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This strategy has moved beyond simulation and a result record
            exists.
          </p>
          <Button className="mt-5 bg-black text-white" asChild>
            <Link href={`/executions/${execution.execution.id}`}>
              View execution result
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
}

function SimulationComparison({ simulation }: { simulation: Simulation }) {
  const output = simulation.output;
  if (!output) return null;
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <caption className="sr-only">
          Simulation before and after comparison
        </caption>
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-3 font-medium">Metric</th>
            <th className="py-3 font-medium">Before</th>
            <th className="py-3 font-medium">After</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          <tr>
            <th className="py-3 font-medium">Success rate</th>
            <td className="py-3">{percent(output.currentSuccessRate)}</td>
            <td className="py-3 font-semibold text-accent">
              {percent(output.projectedSuccessRate)}
            </td>
          </tr>
          <tr>
            <th className="py-3 font-medium">Revenue</th>
            <td className="py-3">{money(output.currentRevenue)}</td>
            <td className="py-3 font-semibold text-accent">
              {money(output.projectedRevenue)}
            </td>
          </tr>
          <tr>
            <th className="py-3 font-medium">Affected transactions</th>
            <td className="py-3">
              {output.affectedTransactions.toLocaleString("en-IN")}
            </td>
            <td className="py-3 text-muted-foreground">
              Same affected population
            </td>
          </tr>
          <tr>
            <th className="py-3 font-medium">Projected impact</th>
            <td className="py-3 text-muted-foreground">—</td>
            <td className="py-3 font-semibold text-accent">
              {money(output.potentialRevenueRecovery)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function StrategyReviewContent({ id }: { id: string }) {
  const strategy = useQuery({
    queryKey: ["strategies", id],
    queryFn: () => getStrategy(id),
  });
  return (
    <ContentContainer>
      {strategy.isLoading && (
        <div className="space-y-6">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}
      {strategy.isError && (
        <ErrorState message="Unable to load this strategy. Please try again." />
      )}
      {strategy.data && <StrategyContent strategy={strategy.data} id={id} />}
    </ContentContainer>
  );
}

function Skeleton() {
  return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
}
