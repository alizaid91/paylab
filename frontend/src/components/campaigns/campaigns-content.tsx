"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import Link from "next/link";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import {
  getRecoveryCampaigns,
  getRecoveryCampaign,
  resumeRecoveryCampaign,
  startRecoveryCampaign,
  stopRecoveryCampaign,
  type RecoveryCampaign,
} from "@/lib/opportunities-api";

const money = (value: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const statusLabel = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const activeStatuses = ["queued", "running"];

function CampaignCard({ campaign }: { campaign: RecoveryCampaign }) {
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: () => startRecoveryCampaign(campaign.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["recovery-campaigns"], (items: RecoveryCampaign[] | undefined) =>
        items?.map((item) => item.id === updated.id ? updated : item),
      );
    },
  });
  const stop = useMutation({
    mutationFn: () => stopRecoveryCampaign(campaign.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["recovery-campaigns"], (items: RecoveryCampaign[] | undefined) =>
        items?.map((item) => item.id === updated.id ? updated : item),
      );
    },
  });
  const resume = useMutation({
    mutationFn: () => resumeRecoveryCampaign(campaign.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["recovery-campaigns"], (items: RecoveryCampaign[] | undefined) =>
        items?.map((item) => item.id === updated.id ? updated : item),
      );
    },
  });

  const isBusy = start.isPending || stop.isPending || resume.isPending;
  const isActive = activeStatuses.includes(campaign.status);
  const hasError = start.isError || stop.isError || resume.isError;

  return (
    <article className="rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Recovery Campaign
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            Strategy recovery campaign
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updated {new Date(campaign.updatedAt).toLocaleString("en-IN")}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {statusLabel(campaign.status)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Target" value={campaign.targetCount.toLocaleString("en-IN")} />
        <Metric label="Processed" value={`${campaign.processedCount.toLocaleString("en-IN")} / ${campaign.eligibleCount.toLocaleString("en-IN")}`} />
        <Metric label="Successful" value={campaign.successfulCount.toLocaleString("en-IN")} />
        <Metric label="Recovered" value={money(campaign.recoveredAmount)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {campaign.status === "approved" && (
          <Button onClick={() => start.mutate()} disabled={isBusy}>
            {start.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Start Campaign
          </Button>
        )}
        {isActive && (
          <Button variant="outline" onClick={() => stop.mutate()} disabled={isBusy}>
            {stop.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-2 h-4 w-4" />}
            Stop Campaign
          </Button>
        )}
        {campaign.status === "cancelled" && (
          <Button variant="outline" onClick={() => resume.mutate()} disabled={isBusy}>
            {resume.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resume Campaign
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={`/campaigns/${campaign.id}`}>View details</Link>
        </Button>
      </div>

      {hasError && (
        <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Unable to update this campaign. Please try again.
        </p>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export default function CampaignsContent({ campaignId }: { campaignId?: string }) {
  const campaigns = useQuery({
    queryKey: ["recovery-campaigns"],
    queryFn: getRecoveryCampaigns,
    enabled: !campaignId,
    refetchInterval: (query) =>
      query.state.data?.some((campaign) => activeStatuses.includes(campaign.status))
        ? 5000
        : false,
  });
  const campaign = useQuery({
    queryKey: ["recovery-campaigns", campaignId],
    queryFn: () => getRecoveryCampaign(campaignId!),
    enabled: Boolean(campaignId),
    refetchInterval: (query) =>
      query.state.data && activeStatuses.includes(query.state.data.status) ? 5000 : false,
  });
  const items = campaignId
    ? (campaign.data ? [campaign.data] : [])
    : (campaigns.data ?? []);

  if (campaigns.isLoading || campaign.isLoading) {
    return <ContentContainer><div className="h-64 animate-pulse rounded-lg bg-muted" /></ContentContainer>;
  }
  if (campaigns.isError || campaign.isError) {
    return <ContentContainer><ErrorState message="Unable to load recovery campaigns." /></ContentContainer>;
  }

  return (
    <ContentContainer>
      <div className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Execution control plane</p>
        <h1 className="mt-2 text-2xl font-semibold">Recovery Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor approved recovery strategies, control execution, and review outcomes.
        </p>
      </div>
      <div className="mt-8 space-y-5">
        {items.length ? items.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        )) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No recovery campaigns have been created yet.
          </div>
        )}
      </div>
    </ContentContainer>
  );
}
