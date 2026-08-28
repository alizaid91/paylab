"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { getMerchant, updateMerchant } from "@/lib/auth-api";
import { getMerchantPolicy, updateMerchantPolicy, type Policy } from "@/lib/opportunities-api";

type PolicyForm = Policy["rules"];

export default function SettingsContent() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const merchant = useQuery({ queryKey: ["merchant"], queryFn: getMerchant });
  const policy = useQuery({ queryKey: ["merchant", "policy"], queryFn: getMerchantPolicy });
  const [merchantName, setMerchantName] = useState("");
  const [merchantSlug, setMerchantSlug] = useState("");
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [rules, setRules] = useState<PolicyForm | null>(null);
  useEffect(() => {
    if (merchant.data) {
      setMerchantName(merchant.data.name);
      setMerchantSlug(merchant.data.slug);
      setCurrency(merchant.data.defaultCurrency);
      setTimezone(merchant.data.timezone);
    }
  }, [merchant.data]);
  useEffect(() => {
    if (policy.data) setRules(policy.data.rules);
  }, [policy.data]);
  const merchantSave = useMutation({ mutationFn: () => updateMerchant({ name: merchantName, slug: merchantSlug, defaultCurrency: currency, timezone }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant"] }) });
  const policySave = useMutation({ mutationFn: () => updateMerchantPolicy(rules!), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant", "policy"] }) });
  if (merchant.isLoading || policy.isLoading) return <ContentContainer><div className="h-96 animate-pulse rounded-lg bg-muted" /></ContentContainer>;
  if (merchant.isError || policy.isError || !rules) return <ContentContainer><ErrorState message="Unable to load settings." /></ContentContainer>;
  const updateRule = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => setRules((current) => current ? { ...current, [key]: value } : current);
  return <ContentContainer><div className="border-b pb-6"><p className="text-xs font-semibold uppercase tracking-wider text-accent">Workspace</p><h1 className="mt-2 text-2xl font-semibold">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Manage your merchant profile and revenue optimization safety policies.</p></div><section className="mt-8"><h2 className="text-lg font-semibold">Merchant Profile</h2><p className="mt-1 text-sm text-muted-foreground">Basic account and workspace information.</p><div className="mt-4 grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2"><Field label="Merchant name" value={merchantName} onChange={setMerchantName} /><Field label="Merchant slug" value={merchantSlug} onChange={setMerchantSlug} /><Field label="Default currency" value={currency} onChange={setCurrency} /><Field label="Timezone" value={timezone} onChange={setTimezone} /><div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Account email</p><p className="mt-1 text-sm">{session?.user.email}</p></div><div className="sm:col-span-2"><Button onClick={() => merchantSave.mutate()} disabled={merchantSave.isPending}><Save className="mr-2 h-4 w-4" />{merchantSave.isPending ? "Saving..." : "Save Profile"}</Button>{merchantSave.isSuccess && <span className="ml-3 text-sm text-emerald-700">Profile saved.</span>}{merchantSave.isError && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />Unable to save profile.</p>}</div></div></section><section className="mt-8"><h2 className="text-lg font-semibold">Revenue Optimization Policies</h2><p className="mt-1 text-sm text-muted-foreground">{policy.data?.name} · {policy.data?.status}</p><div className="mt-4 grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2"><NumberField label="Max affected transaction %" value={rules.maxAffectedTransactionPercentage} onChange={(value) => updateRule("maxAffectedTransactionPercentage", value)} /><NumberField label="Max revenue exposure %" value={rules.maxRevenueExposurePercentage} onChange={(value) => updateRule("maxRevenueExposurePercentage", value)} /><NumberField label="Minimum strategy confidence %" value={rules.minimumStrategyConfidence} onChange={(value) => updateRule("minimumStrategyConfidence", value)} /><NumberField label="Minimum simulation confidence %" value={rules.minimumSimulationConfidence} onChange={(value) => updateRule("minimumSimulationConfidence", value)} /><NumberField label="Allowed execution start hour" value={rules.allowedExecutionHours.start} onChange={(value) => updateRule("allowedExecutionHours", { ...rules.allowedExecutionHours, start: value })} /><NumberField label="Allowed execution end hour" value={rules.allowedExecutionHours.end} onChange={(value) => updateRule("allowedExecutionHours", { ...rules.allowedExecutionHours, end: value })} /><Field label="Max daily execution amount" value={rules.maxDailyExecutionAmount} onChange={(value) => updateRule("maxDailyExecutionAmount", value)} /><div><p className="text-sm font-medium">Allowed payment methods</p><div className="mt-2 flex flex-wrap gap-4">{["upi", "card", "net_banking"].map((method) => <label key={method} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rules.allowedPaymentMethods.includes(method)} onChange={(event) => updateRule("allowedPaymentMethods", event.target.checked ? [...rules.allowedPaymentMethods, method] : rules.allowedPaymentMethods.filter((item) => item !== method))} />{method.replace("_", " ")}</label>)}</div></div><div className="sm:col-span-2"><Button onClick={() => policySave.mutate()} disabled={policySave.isPending}><Save className="mr-2 h-4 w-4" />{policySave.isPending ? "Saving..." : "Save Policies"}</Button>{policySave.isSuccess && <span className="ml-3 inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Policies saved.</span>}{policySave.isError && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />Unable to save policies.</p>}</div></div></section></ContentContainer>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex flex-col gap-1 text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border bg-background px-3 font-normal focus:outline-none focus:ring-2 focus:ring-ring" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="flex flex-col gap-1 text-sm font-medium">{label}<input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 rounded-md border bg-background px-3 font-normal focus:outline-none focus:ring-2 focus:ring-ring" /></label>;
}
