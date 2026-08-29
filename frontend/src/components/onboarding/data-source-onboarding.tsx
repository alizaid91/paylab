"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Database,
  Loader2,
  Plug,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/auth-provider";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-error";
import { generateDemoData } from "@/lib/payments-api";

export function DataSourceOnboarding() {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const dataSource = session?.merchant?.dataSource ?? "none";
  const hasDemoData = dataSource === "demo";
  const hasConnectedSource = dataSource !== "none";

  const dataSourceLabel =
    dataSource === "demo"
      ? "Demo Data"
      : dataSource === "razorpay_live"
        ? "Razorpay Live Data"
        : "No data source connected";

  const mutation = useMutation({
    mutationFn: generateDemoData,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

      if (result.generated || result.payments > 0) {
        router.replace("/payments");
      }
    },
  });

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Get started"
        title="Connect your payment data"
        description="Choose how PAYLAB should access payment data for your merchant workspace."
      />

      {/* Current connection */}
      <div className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current connection
            </p>

            <p className="mt-2 text-lg font-semibold">{dataSourceLabel}</p>

            <p className="mt-1 text-sm text-muted-foreground">
              {hasDemoData
                ? "This merchant is using generated demo payment data."
                : hasConnectedSource
                  ? "This merchant is connected to a live payment data source."
                  : "Connect a payment source to start analyzing your transactions."}
            </p>
          </div>

          {hasConnectedSource && (
            <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          )}
        </div>
      </div>

      {/* Data source cards */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Razorpay */}
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          {/* Subtle brand background */}
          <div className="absolute right-0 top-0 h-40 w-40 translate-x-12 -translate-y-12 rounded-full bg-[#3395FF]/10 blur-2xl" />

          <div className="relative p-6">
            <div className="flex items-start justify-between">
              {/* Razorpay Logo */}
              <div className="flex h-12 items-center rounded-lg border bg-white px-4 shadow-sm">
                <Image
                  src="/razorpay.png"
                  alt="Razorpay"
                  width={108}
                  height={28}
                  className="h-7 w-auto object-contain"
                  priority
                />
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3395FF]/10 text-[#3395FF]">
                <Plug className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Connect Razorpay</h2>

                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Coming soon
                </span>
              </div>

              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Securely connect your Razorpay account and analyze your real
                payment history inside PAYLAB.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Secure OAuth connection
            </div>

            <Button
              className="mt-6 w-full sm:w-auto"
              variant="outline"
              type="button"
              disabled
            >
              Connect Razorpay
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Demo Data */}
        <div className="rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Database className="h-6 w-6" />
              </div>

              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                Recommended for testing
              </span>
            </div>

            <h2 className="mt-6 text-lg font-semibold">Use Demo Data</h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Generate realistic payment, customer, and retry history to explore
              the full PAYLAB workflow without connecting a real payment
              account.
            </p>

            <Button
              className="mt-6 w-full sm:w-auto"
              type="button"
              onClick={() => mutation.mutate()}
              disabled={
                hasConnectedSource || mutation.isPending || mutation.isSuccess
              }
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {hasDemoData
                ? "Demo Data Connected"
                : mutation.isPending
                  ? "Generating demo data..."
                  : mutation.isSuccess
                    ? "Demo data generated"
                    : hasConnectedSource
                      ? "Unavailable"
                      : "Use Demo Data"}
            </Button>

            {hasDemoData && (
              <p className="mt-4 text-sm text-muted-foreground">
                Demo data generation is disabled because this merchant already
                has Demo Data connected.
              </p>
            )}

            {mutation.isSuccess && (
              <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Payment data is ready. Redirecting to payments...
              </p>
            )}

            {mutation.isError && (
              <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <p>
                  {mutation.error instanceof ApiError
                    ? mutation.error.message
                    : "Unable to generate demo data. Please try again."}
                </p>

                <button
                  className="mt-2 inline-flex items-center gap-1 font-medium underline"
                  type="button"
                  onClick={() => mutation.reset()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ContentContainer>
  );
}
