"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import {
  approveStrategy,
  createRecoveryCampaign,
  getAuditLogs,
  getRecoveryCampaign,
  getStrategy,
  getStrategySimulations,
  startRecoveryCampaign,
  stopRecoveryCampaign,
  type RecoveryCampaign,
} from "@/lib/opportunities-api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const money = (value: unknown) => currency.format(Number(value) || 0);
const percent = (value: unknown) => `${Number(value || 0).toFixed(2)}%`;
const title = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const humanizeCampaignStatus = (status: string) => {
  const normalized = String(status ?? "").toLowerCase();
  const labels: Record<string, string> = {
    draft: "Draft",
    approved: "Approved",
    queued: "Queued",
    running: "Running",
    paused: "Paused",
    completed: "Completed",
    stopped_by_rule: "Stopped by Rule",
    cancelled: "Cancelled",
    failed: "Failed",
  };
  return labels[normalized] ?? title(normalized.replace(/_/g, " "));
};

const isCampaignActive = (status: string) =>
  ["queued", "running"].includes(String(status ?? "").toLowerCase());

const isCampaignTerminal = (status: string) =>
  ["completed", "stopped_by_rule", "cancelled", "failed"].includes(
    String(status ?? "").toLowerCase(),
  );

const getRecoveryRate = (campaign: RecoveryCampaign) => {
  if (!campaign.eligibleCount) return 0;
  return (campaign.successfulCount / campaign.eligibleCount) * 100;
};

const getPredictionVariance = (predicted: number, actual: number) => {
  if (!Number.isFinite(predicted) || predicted === 0) return 0;
  return actual - predicted;
};

const getPredictionAccuracy = (predicted: number, actual: number) => {
  if (!Number.isFinite(predicted) || predicted === 0) return 0;
  const delta = Math.abs(actual - predicted);
  return 1 - delta / predicted;
};

function SummaryCard({
  heading,
  children,
}: Readonly<{ heading: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <div className="mt-2 text-sm leading-6">{children}</div>
    </div>
  );
}

function RecoveryCampaignSection({
  campaign,
  strategyName,
  strategySnapshot,
  startCampaign,
  stopCampaign,
  isStarting,
  isStopping,
}: {
  campaign: RecoveryCampaign | undefined;
  strategyName: string;
  strategySnapshot: Record<string, unknown>;
  startCampaign: () => void;
  stopCampaign: () => void;
  isStarting: boolean;
  isStopping: boolean;
}) {
  if (!campaign) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-muted-foreground/30 bg-background p-5 text-sm text-muted-foreground">
        Loading recovery campaign…
      </div>
    );
  }

  const maxRetries = Number(
    strategySnapshot.maxAttempts ??
      strategySnapshot.max_attempts ??
      strategySnapshot.retryLimit ??
      2,
  );
  const minimumRecoveryRate = Number(
    strategySnapshot.minimumRecoveryRate ??
      strategySnapshot.minimum_recovery_rate ??
      40,
  );
  const campaignLimit = Number(campaign.targetCount || campaign.eligibleCount || 0);
  const progressText = `${(campaign.processedCount ?? 0).toLocaleString("en-IN")} / ${campaignLimit.toLocaleString("en-IN")} processed`;

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Recovery Campaign
          </p>
          <h3 className="mt-2 text-xl font-semibold">{strategyName}</h3>
        </div>
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          {humanizeCampaignStatus(campaign.status)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard heading="Strategy">
          <p className="font-medium">{String(strategySnapshot.action ?? "RETRY").toUpperCase()}</p>
        </SummaryCard>
        <SummaryCard heading="Target">
          <strong>{campaign.targetCount.toLocaleString("en-IN")}</strong>
        </SummaryCard>
        <SummaryCard heading="Revenue at Risk">
          <strong>{money(campaign.revenueAtRisk)}</strong>
        </SummaryCard>
        <SummaryCard heading="Expected Recovery">
          <strong>{money(campaign.expectedRecoveryAmount)}</strong>
        </SummaryCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard heading="Execution Mode">
          <strong>Simulated</strong>
        </SummaryCard>
        <SummaryCard heading="Maximum retries">
          <strong>{maxRetries.toLocaleString("en-IN")}</strong>
        </SummaryCard>
        <SummaryCard heading="Campaign limit">
          <strong>{campaignLimit.toLocaleString("en-IN")}</strong>
        </SummaryCard>
        <SummaryCard heading="Minimum recovery rate">
          <strong>{minimumRecoveryRate.toFixed(0)}%</strong>
        </SummaryCard>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Approval
        </p>
        <p className="mt-2 font-medium text-emerald-700">Merchant approved</p>
      </div>

      {campaign.status === "approved" && campaign.eligibleCount === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Campaign is ready to resolve the current eligible batch. Start recovery to evaluate payments.
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="text-sm font-medium">{progressText}</p>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard heading="Recovered">
              <strong>{money(campaign.recoveredAmount)}</strong>
            </SummaryCard>
            <SummaryCard heading="Successful">
              <strong>{campaign.successfulCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
            <SummaryCard heading="Failed">
              <strong>{campaign.failedCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
            <SummaryCard heading="Skipped">
              <strong>{campaign.skippedCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {campaign.status === "approved" && (
          <Button onClick={startCampaign} disabled={isStarting}>
            {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isStarting ? "Starting recovery..." : "START RECOVERY"}
          </Button>
        )}

        {isCampaignActive(campaign.status) && (
          <Button variant="outline" onClick={stopCampaign} disabled={isStopping}>
            {isStopping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isStopping ? "Stopping campaign..." : "STOP CAMPAIGN"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ExecuteContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [approved, setApproved] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedCampaignId = window.sessionStorage.getItem(
      `paylab_recovery_campaign_${id}`,
    );
    if (storedCampaignId) setCampaignId(storedCampaignId);
  }, [id]);

  const strategy = useQuery({
    queryKey: ["strategies", id],
    queryFn: () => getStrategy(id),
  });
  const simulations = useQuery({
    queryKey: ["strategies", id, "simulations"],
    queryFn: () => getStrategySimulations(id),
  });
  const campaign = useQuery({
    queryKey: ["recovery-campaigns", campaignId],
    queryFn: () => getRecoveryCampaign(campaignId!),
    enabled: Boolean(campaignId),
    refetchInterval: (query) => {
      const status = String(query.state.data?.status ?? "");
      return status && isCampaignActive(status) ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });
  const campaignAuditLogs = useQuery({
    queryKey: ["audit-logs", "campaign", campaignId],
    queryFn: () => (campaignId ? getAuditLogs(undefined, undefined, campaignId) : Promise.resolve([])),
    enabled: Boolean(campaignId),
  });

  const approval = useMutation({
    mutationFn: () => approveStrategy(id),
    onSuccess: async () => {
      setApproved(true);
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      try {
        const createdCampaign = await createRecoveryCampaign(id);
        setCampaignId(createdCampaign.id);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            `paylab_recovery_campaign_${id}`,
            createdCampaign.id,
          );
        }
      } catch {
        if (typeof window !== "undefined") {
          const existing = window.sessionStorage.getItem(
            `paylab_recovery_campaign_${id}`,
          );
          if (existing) setCampaignId(existing);
        }
      }
    },
  });

  const startCampaignMutation = useMutation({
    mutationFn: () => startRecoveryCampaign(campaignId!),
    onSuccess: (updatedCampaign) => {
      setCampaignId(updatedCampaign.id);
      queryClient.setQueryData(["recovery-campaigns", updatedCampaign.id], updatedCampaign);
      queryClient.invalidateQueries({ queryKey: ["recovery-campaigns", updatedCampaign.id] });
    },
  });

  const stopCampaignMutation = useMutation({
    mutationFn: () => stopRecoveryCampaign(campaignId!, "MERCHANT_CANCELLATION"),
    onSuccess: (updatedCampaign) => {
      setCampaignId(updatedCampaign.id);
      queryClient.setQueryData(["recovery-campaigns", updatedCampaign.id], updatedCampaign);
      queryClient.invalidateQueries({ queryKey: ["recovery-campaigns", updatedCampaign.id] });
    },
  });

  const configuration = (strategy.data?.configuration ?? {}) as Record<
    string,
    unknown
  >;
  const impact = (configuration.expectedImpact ?? {}) as Record<
    string,
    unknown
  >;
  const simulation = simulations.data?.find(
    (item) => item.status === "completed",
  );
  const output = simulation?.output;
  const isApproved = approved || strategy.data?.status === "merchant_approved";
  const canApprove = strategy.data?.status === "policy_approved";

  const activeCampaign = campaign.data;
  const campaignStrategySnapshot = (activeCampaign?.strategySnapshot ?? strategy.data?.configuration ?? {}) as Record<string, unknown>;
  const simulationRecoveryAmount = Number(
    (output?.potentialRevenueRecovery as string | number | undefined) ?? 0,
  );
  const simulationRecoveryRate = Number(output?.projectedSuccessRate ?? 0);
  const actualRecoveryRate = activeCampaign ? getRecoveryRate(activeCampaign) : 0;
  const actualRecoveryAmount = activeCampaign ? Number(activeCampaign.recoveredAmount || 0) : 0;
  const variance = getPredictionVariance(simulationRecoveryAmount, actualRecoveryAmount);
  const accuracy = getPredictionAccuracy(simulationRecoveryAmount, actualRecoveryAmount);
  const campaignExplanation = activeCampaign
    ? [
        activeCampaign.skippedCount > 0 ? `Some payments were skipped during the campaign (${activeCampaign.skippedCount.toLocaleString("en-IN")}).` : null,
        activeCampaign.failedCount > 0 ? `Some recovery attempts failed (${activeCampaign.failedCount.toLocaleString("en-IN")}).` : null,
        activeCampaign.processedCount < activeCampaign.eligibleCount ? `The campaign processed fewer eligible transactions than available (${activeCampaign.processedCount.toLocaleString("en-IN")} of ${activeCampaign.eligibleCount.toLocaleString("en-IN")}).` : null,
        activeCampaign.stoppingReason ? `The campaign stopped because: ${title(activeCampaign.stoppingReason.replace(/_/g, " "))}.` : null,
      ].filter(Boolean) as string[]
    : [];

  if (strategy.isLoading || simulations.isLoading)
    return (
      <ContentContainer>
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </ContentContainer>
    );
  if (strategy.isError || simulations.isError || !strategy.data)
    return (
      <ContentContainer>
        <ErrorState message="Unable to load the strategy execution review." />
      </ContentContainer>
    );

  return (
    <ContentContainer>
      <div className="border-b pb-6">
        <Link
          href={`/strategies/${id}/review`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to safety review
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-accent">
          Merchant approval
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Approve Strategy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {strategy.data.name} · Simulated execution in the PAYLAB MVP
        </p>
      </div>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Final Review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm the recommendation and safety checks before execution.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard heading="Problem">
            <p>
              {strategy.data.opportunity?.name ?? "Source opportunity"} created
              this strategy.
            </p>
          </SummaryCard>
          <SummaryCard heading="Recommendation">
            <p>
              {String(configuration.objective ?? "Strategy recommendation")}
            </p>
          </SummaryCard>
          <SummaryCard heading="Expected Impact">
            <p>
              Revenue recovery:{" "}
              <strong>
                {money(String(impact.estimatedRevenueRecovery ?? "0"))}
              </strong>
            </p>
            <p>
              Projected success rate:{" "}
              <strong>
                {output ? percent(output.projectedSuccessRate) : "Not available"}
              </strong>
            </p>
          </SummaryCard>
          <SummaryCard heading="Risk">
            <p className="capitalize">
              {output?.riskLevel ? String(output.riskLevel) : "Not available"}
            </p>
          </SummaryCard>
          <SummaryCard heading="Policy Result">
            <p className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              {canApprove || isApproved ? "PASSED" : "Pending policy approval"}
            </p>
          </SummaryCard>
          <SummaryCard heading="Advisory Result">
            <p className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              {canApprove || isApproved
                ? "APPROVED"
                : "Pending advisory approval"}
            </p>
          </SummaryCard>
        </div>
      </section>

      <section className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Merchant Approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approval is validated by the backend against the advisory and policy
          results.
        </p>
        {!isApproved ? (
          <Button
            className="mt-5"
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to approve this strategy?",
                )
              )
                approval.mutate();
            }}
            disabled={!canApprove || approval.isPending}
          >
            {approval.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {approval.isPending ? "Approving strategy..." : "Approve Strategy"}
          </Button>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-semibold">Strategy approved</span>
            </div>
            {campaignId && (
              <Button asChild variant="outline">
                <Link href={`/campaigns/${campaignId}`}>Open Recovery Campaign</Link>
              </Button>
            )}
          </div>
        )}
        {approval.isError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            Unable to approve this strategy. Confirm that policy and advisory
            checks have passed.
          </div>
        )}
      </section>

      {false && isApproved && (
        <section className="mt-8 rounded-lg border border-accent/20 bg-accent/5 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Recovery Campaign</h2>
            {campaign.data && (
              <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                {humanizeCampaignStatus(campaign.data?.status ?? "")}
              </span>
            )}
          </div>

          {campaign.isLoading ? (
            <div className="mt-5 rounded-lg border border-dashed border-muted-foreground/30 bg-background p-5 text-sm text-muted-foreground">
              Loading recovery campaign…
            </div>
          ) : campaign.isError && campaignId ? (
            <div
              role="alert"
              className="mt-5 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4" />
              Unable to load the recovery campaign state.
            </div>
          ) : activeCampaign ? (
            <RecoveryCampaignSection
              campaign={activeCampaign}
              strategyName={strategy.data?.name ?? ""}
              strategySnapshot={campaignStrategySnapshot}
              startCampaign={() => {
                if (window.confirm("Start this recovery campaign?"))
                  startCampaignMutation.mutate();
              }}
              stopCampaign={() => {
                if (window.confirm("Stop this recovery campaign?\n\nNew recovery actions will no longer be executed."))
                  stopCampaignMutation.mutate();
              }}
              isStarting={startCampaignMutation.isPending}
              isStopping={stopCampaignMutation.isPending}
            />
          ) : (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing the recovery campaign…
            </div>
          )}
        </section>
      )}

      {campaign.data && isCampaignTerminal(campaign.data.status) && (
        <section className="mt-8 rounded-lg border bg-card p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Recovery results
              </p>
              <h2 className="mt-2 text-xl font-semibold">Actual recovered</h2>
            </div>
            <span className="text-3xl font-semibold text-emerald-700">
              {money(campaign.data.recoveredAmount)}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard heading="Revenue at Risk">
              <strong>{money(campaign.data.revenueAtRisk)}</strong>
            </SummaryCard>
            <SummaryCard heading="Expected Recovery">
              <strong>{money(campaign.data.expectedRecoveryAmount)}</strong>
            </SummaryCard>
            <SummaryCard heading="Actual Recovered">
              <strong>{money(campaign.data.recoveredAmount)}</strong>
            </SummaryCard>
            <SummaryCard heading="Recovery Rate">
              <strong>{`${actualRecoveryRate.toFixed(2)}%`}</strong>
            </SummaryCard>
            <SummaryCard heading="Recovered Transactions">
              <strong>{campaign.data.successfulCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
            <SummaryCard heading="Processed Transactions">
              <strong>{campaign.data.processedCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
            <SummaryCard heading="Failed Transactions">
              <strong>{campaign.data.failedCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
            <SummaryCard heading="Skipped Transactions">
              <strong>{campaign.data.skippedCount.toLocaleString("en-IN")}</strong>
            </SummaryCard>
          </div>

          <div className="mt-8 overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Metric</th>
                  <th className="px-5 py-3 font-medium">Simulation</th>
                  <th className="px-5 py-3 font-medium">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <th className="px-5 py-4 font-medium">Recovery rate</th>
                  <td className="px-5 py-4">{`${simulationRecoveryRate.toFixed(2)}%`}</td>
                  <td className="px-5 py-4">{`${actualRecoveryRate.toFixed(2)}%`}</td>
                </tr>
                <tr>
                  <th className="px-5 py-4 font-medium">Revenue recovery</th>
                  <td className="px-5 py-4">{money(String(simulationRecoveryAmount || 0))}</td>
                  <td className="px-5 py-4">{money(campaign.data.recoveredAmount)}</td>
                </tr>
                <tr>
                  <th className="px-5 py-4 font-medium">Recovered transactions</th>
                  <td className="px-5 py-4">{Math.max(0, Math.round(simulationRecoveryRate / 100 * (campaign.data.eligibleCount || 0))).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-4">{campaign.data.successfulCount.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <th className="px-5 py-4 font-medium">Prediction variance</th>
                  <td className="px-5 py-4" colSpan={2}>{money(String(variance))}</td>
                </tr>
                <tr>
                  <th className="px-5 py-4 font-medium">Prediction accuracy</th>
                  <td className="px-5 py-4" colSpan={2}>{`${(accuracy * 100).toFixed(2)}%`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold">Stopping rules</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                {campaign.data.stoppingReason
                  ? `Campaign automatically stopped. Reason: ${title(campaign.data.stoppingReason.replace(/_/g, " "))}.`
                  : "No stopping rule triggered."}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold">Explanation</h3>
              {campaignExplanation.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {campaignExplanation.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No additional explanation was available from the execution data.</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold">Campaign Activity</h3>
            <div className="mt-4 rounded-lg border bg-card p-6">
              {campaignAuditLogs.isLoading ? (
                <div className="h-32 animate-pulse rounded-lg bg-muted" />
              ) : campaignAuditLogs.isError ? (
                <p className="text-sm text-destructive">Unable to load campaign activity.</p>
              ) : campaignAuditLogs.data?.length ? (
                <ol className="space-y-5">
                  {campaignAuditLogs.data.map((event) => (
                    <li key={event.id} className="relative border-l-2 border-accent/30 pl-5">
                      <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-accent" />
                      <p className="text-sm text-muted-foreground">
                        {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}
                      </p>
                      <p className="mt-1 font-medium">{title(String(event.action).replace(/_/g, " "))}</p>
                      {event.metadata && typeof event.metadata === "object" && "amount" in event.metadata && (
                        <p className="mt-1 text-sm text-muted-foreground">{money(String((event.metadata as Record<string, unknown>).amount ?? 0))}</p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No campaign activity was recorded.</p>
              )}
            </div>
          </div>
        </section>
      )}

    </ContentContainer>
  );
}

export default function ExecuteStrategyContent({ id }: { id: string }) {
  return <ExecuteContent id={id} />;
}
