"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
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
  if (Array.isArray(value)) return value.map((item) => formatValue(key, item)).join(", ");
  if (value && typeof value === "object") return readableValue(value);
  if (typeof value === "number") {
    if (key.toLowerCase().endsWith("ms")) return `${value.toLocaleString("en-IN")} ms`;
    return value.toLocaleString("en-IN");
  }
  const text = String(value ?? "Not provided");
  return /[_-]/.test(text) || text === text.toUpperCase()
    ? title(text)
    : text;
};
const readableValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map((item) => formatValue("", item)).join(", ");
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
      queryClient.invalidateQueries({ queryKey: ["strategies", id, "simulations"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
    },
  });
  const canSimulate = strategy.status === "generated";
  const canRunAdvisory = strategy.status === "simulated";
  const canGoToReview = !["draft", "generated", "simulated"].includes(strategy.status);
  const configuration = strategy.configuration;
  const expectedImpact = (configuration.expectedImpact ?? {}) as Record<
    string,
    unknown
  >;
  const trigger = (configuration.trigger ?? {}) as Record<string, unknown>;
  const actions = Array.isArray(configuration.actions)
    ? configuration.actions
    : [];
  const assumptions = Array.isArray(configuration.assumptions)
    ? configuration.assumptions
    : [];
  const risks = Array.isArray(configuration.risks) ? configuration.risks : [];
  const completedSimulation = simulations.data?.find(
    (item) => item.status === "completed",
  );
  const displaySimulation =
    strategy.status === "simulated"
      ? completedSimulation
      : simulation.data ?? completedSimulation;
  const simulationOutput = displaySimulation?.output;
  const execution = executions.data?.find(
    (item) => item.execution.strategyId === id,
  );

  return (
    <>
      <div className="border-b pb-6">
        <div className="mb-4">
          <Link
            href={`/opportunities/${strategy.opportunity?.id ?? ""}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to opportunity
          </Link>
        </div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Strategy review
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              What does PAYLAB recommend, and what could happen if we apply it?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {strategy.opportunity?.name ?? "Opportunity"} · Created{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(strategy.createdAt))}
            </p>
          </div>
          <StatusBadge status={strategy.status} />
        </div>
      </div>
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Strategy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The recommendation translated into an actionable plan.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card heading="Objective">
            <p className="mt-2 text-sm leading-6">
              {String(configuration.objective ?? "Not provided")}
            </p>
          </Card>
          <Card heading="Target Segment">
            <p className="mt-2 text-sm leading-6">
              {String(configuration.targetSegment ?? "Not provided")}
            </p>
          </Card>
          <Card heading="Trigger">
            <p className="mt-2 text-sm">
              {title(String(trigger.type ?? "Not provided"))}
            </p>
            {Array.isArray(trigger.conditions) && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {trigger.conditions.map((condition) => (
                  <li key={String(condition)}>{formatValue("", condition)}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card heading="Recommended Actions">
            <ol className="mt-2 space-y-3 text-sm">
              {actions.map((action, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">
                      {typeof action === "object" &&
                      action !== null &&
                      "action" in action
                        ? title(String(action.action))
                        : formatValue("", action)}
                    </p>
                    {typeof action === "object" &&
                      action !== null &&
                      "parameters" in action &&
                      readableParameters(action.parameters).length > 0 && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {readableParameters(action.parameters).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="rounded-md bg-muted/50 px-3 py-2"
                              >
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  {title(key)}
                                </p>
                                <p className="mt-1 text-xs font-medium">
                                  {formatValue(key, value)}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>{" "}
          <Card heading="Expected Impact">
            <p className="mt-2 text-sm">
              Success-rate improvement:{" "}
              <strong>
                {percent(Number(expectedImpact.successRateLiftPercentage))}
              </strong>
            </p>
            <p className="mt-1 text-sm">
              Revenue recovery:{" "}
              <strong>
                {percent(Number(expectedImpact.revenueRecoveryPercentage))}
              </strong>
            </p>
            <p className="mt-1 text-sm">
              Estimated recovery:{" "}
              <strong>
                {money(String(expectedImpact.estimatedRevenueRecovery ?? "0"))}
              </strong>
            </p>
          </Card>
          <Card heading="Confidence">
            <p className="mt-2 text-2xl font-semibold">
              {percent(Number(configuration.confidence))}
            </p>
          </Card>
          <Card heading="Assumptions">
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {assumptions.map((item) => (
                <li key={String(item)}>{String(item)}</li>
              ))}
            </ul>
          </Card>
          <Card heading="Risks">
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {risks.map((item) => (
                <li key={String(item)}>{String(item)}</li>
              ))}
            </ul>
          </Card>
          <Card heading="Reasoning">
            <p className="mt-2 text-sm leading-6">
              {String(configuration.reasoning ?? "Not provided")}
            </p>
          </Card>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Expected Impact</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What the strategy predicts before a simulation is run.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card heading="Success-rate improvement">
            <p className="mt-2 text-2xl font-semibold text-accent">
              {percent(Number(expectedImpact.successRateLiftPercentage))}
            </p>
          </Card>
          <Card heading="Expected revenue recovery">
            <p className="mt-2 text-2xl font-semibold text-accent">
              {money(String(expectedImpact.estimatedRevenueRecovery ?? "0"))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {percent(Number(expectedImpact.revenueRecoveryPercentage))} of
              affected revenue
            </p>
          </Card>
          <Card heading="Affected transactions">
            <p className="mt-2 text-2xl font-semibold">
              {(
                strategy.opportunity?.affectedTransactionCount ?? 0
              ).toLocaleString("en-IN")}
            </p>
          </Card>
          <Card heading="Confidence">
            <p className="mt-2 text-2xl font-semibold">
              {percent(Number(configuration.confidence))}
            </p>
          </Card>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Simulation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare current payment performance with the backend projection.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="mb-6 text-sm text-muted-foreground">
            PAYLAB generates a recovery assumption automatically for this strategy.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => simulation.mutate()}
              disabled={!canSimulate || simulation.isPending}
            >
              {simulation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {simulation.isPending ? "Running simulation..." : "Run Simulation"}
            </Button>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Button
              onClick={() => router.push(`/strategies/${id}/review`)}
              disabled={!canRunAdvisory}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Run Advisory Review
            </Button>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Button
              variant="outline"
              onClick={() => router.push(`/strategies/${id}/review`)}
              disabled={!canGoToReview}
            >
              Go to Review
            </Button>
          </div>
          {simulation.isError && (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4" />
              Unable to run simulation. Please try again.
            </div>
          )}
          {strategy.status !== "simulated" &&
            simulationOutput &&
            displaySimulation && (
            <SimulationComparison simulation={displaySimulation} />
            )}
        </div>
      </section>
      <section className="mt-8 rounded-lg border border-accent/20 bg-green-200 px-6 p-3">
          {simulationOutput ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">
                Potential Revenue Recovery
              </p>
              <p className="mt-2 text-3xl font-semibold text-accent">
                {money(simulationOutput.potentialRevenueRecovery)}
              </p>
            </>
          ) : (
            <p className="text-sm text-black">
              A completed simulation is available for advisory review.
            </p>
          )}
        </section>
      {strategy.status === "simulated" ? (
        <section className="mt-4 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Simulation Comparison</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is the completed simulation for the strategy.
          </p>
          {simulations.isLoading ? (
            <div className="mt-5 h-36 animate-pulse rounded-lg bg-muted" />
          ) : simulations.isError ? (
            <p className="mt-5 text-sm text-destructive">
              Unable to load the completed simulation.
            </p>
          ) : displaySimulation?.output ? (
            <SimulationComparison simulation={displaySimulation} />
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No completed simulation output is available.
            </p>
          )}
        </section>
      ) : (
        <section className="mt-4">
          <SimulationHistory
            simulations={simulations.data ?? []}
            isLoading={simulations.isLoading}
            isError={simulations.isError}
          />
        </section>
      )}
      {execution && (
        <section className="mt-8 rounded-lg border border-accent/20 bg-accent/5 p-6">
          <h2 className="text-lg font-semibold">Execution Result</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This strategy has been executed. View its result and audit timeline.
          </p>
          <Button className="mt-5 bg-black text-white">
            <Link href={`/executions/${execution.execution.id}`}>
              View Execution Result
            </Link>
          </Button>
        </section>
      )}
    </>
  );
}

function SimulationHistory({
  simulations,
  isLoading,
  isError,
}: {
  simulations: Simulation[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <div className="h-36 animate-pulse rounded-lg bg-muted" />;
  }
  if (isError) {
    return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Unable to load past simulations.</div>;
  }
  if (!simulations.length) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No simulations have been run yet.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[900px] text-left text-sm">
        <caption className="sr-only">Past simulations for this strategy</caption>
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Recovery rate</th>
            <th className="px-5 py-3 font-medium">Projected success rate</th>
            <th className="px-5 py-3 font-medium">Projected revenue</th>
            <th className="px-5 py-3 font-medium">Potential recovery</th>
            <th className="px-5 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {simulations.map((item) => {
            const output = item.output;
            return (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                <td className="px-5 py-4">{item.input.recoveryRate !== undefined ? percent(Number(item.input.recoveryRate) * 100) : "Not provided"}</td>
                <td className="px-5 py-4">{output ? percent(output.projectedSuccessRate) : item.projectedConversionRate ? percent(Number(item.projectedConversionRate)) : "Not available"}</td>
                <td className="px-5 py-4">{output?.projectedRevenue || item.projectedRevenue ? money(output?.projectedRevenue ?? item.projectedRevenue ?? "0") : "Not available"}</td>
                <td className="px-5 py-4 font-semibold text-accent">{output ? money(output.potentialRevenueRecovery) : "Not available"}</td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
