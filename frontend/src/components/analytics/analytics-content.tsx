"use client";

import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, CreditCard, IndianRupee, RotateCcw, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ContentContainer } from "@/components/layout/content-container";
import { ErrorState } from "@/components/states/error-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAnalyticsOverview,
  getFailureAnalytics,
  getPaymentMethodAnalytics,
  getTrendAnalytics,
  type AnalyticsOverview,
  type FailureAnalyticsItem,
  type PaymentMethodAnalytics,
  type TrendAnalyticsItem
} from "@/lib/analytics-api";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-IN");
const money = (value: string | number) => currency.format(Number(value) || 0);
const percent = (value: number) => `${Number(value || 0).toFixed(2)}%`;
const chartColors = ["#0f766e", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#64748b"];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function EmptyState({ message = "No data available for this period." }: { message?: string }) {
  return <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{message}</div>;
}

function Section({ title, description, children }: Readonly<{ title: string; description: string; children: React.ReactNode }>) {
  return <section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{children}</section>;
}

function KpiCard({ label, value, icon: Icon, tone }: Readonly<{ label: string; value: string; icon: typeof CreditCard; tone: string }>) {
  return <div className="rounded-lg border bg-card p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className={`rounded-md p-2 ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p></div>;
}

function Overview({ data }: { data: AnalyticsOverview }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <KpiCard label="Payment volume" value={money(data.totalPaymentVolume)} icon={IndianRupee} tone="bg-emerald-50 text-emerald-700" />
    <KpiCard label="Successful revenue" value={money(data.successfulRevenue)} icon={CheckCircle2} tone="bg-blue-50 text-blue-700" />
    <KpiCard label="Failed payment value" value={money(data.failedPaymentValue)} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" />
    <KpiCard label="Success rate" value={percent(data.successRate)} icon={TrendingUp} tone="bg-violet-50 text-violet-700" />
    <KpiCard label="Failure rate" value={percent(data.failureRate)} icon={AlertTriangle} tone="bg-rose-50 text-rose-700" />
    <KpiCard label="Average transaction value" value={money(data.averageTransactionValue)} icon={CreditCard} tone="bg-slate-100 text-slate-700" />
    <KpiCard label="Retry rate" value={percent(data.retryRate)} icon={RotateCcw} tone="bg-cyan-50 text-cyan-700" />
  </div>;
}

function PerformanceBadge({ successRate }: { successRate: number }) {
  const className = successRate >= 90 ? "bg-emerald-50 text-emerald-700" : successRate >= 70 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  const label = successRate >= 90 ? "Strong" : successRate >= 70 ? "Watch" : "Needs attention";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function PaymentMethods({ data }: { data: PaymentMethodAnalytics[] }) {
  if (!data.length) return <EmptyState />;
  return <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Payment method performance</caption><thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Payment method</th><th className="px-5 py-3 font-medium">Transactions</th><th className="px-5 py-3 font-medium">Volume</th><th className="px-5 py-3 font-medium">Success rate</th><th className="px-5 py-3 font-medium">Failure rate</th><th className="px-5 py-3 font-medium">Failed value</th><th className="px-5 py-3 font-medium">Performance</th></tr></thead><tbody className="divide-y">{data.map((item) => <tr key={item.paymentMethod}><th scope="row" className="px-5 py-4 font-medium capitalize">{item.paymentMethod.replace(/_/g, " ")}</th><td className="px-5 py-4">{number.format(item.transactionCount)}</td><td className="px-5 py-4">{money(item.volume)}</td><td className="px-5 py-4">{percent(item.successRate)}</td><td className="px-5 py-4">{percent(item.failureRate)}</td><td className="px-5 py-4">{money(item.failedPaymentValue)}</td><td className="px-5 py-4"><PerformanceBadge successRate={item.successRate} /></td></tr>)}</tbody></table></div>;
}

const tooltipProps = { contentStyle: { borderRadius: 8, border: "1px solid hsl(214 32% 91%)", background: "#fff" }, labelStyle: { color: "#475569" } };
const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));

function Trends({ data }: { data: TrendAnalyticsItem[] }) {
  if (!data.length) return <EmptyState />;
  return <div className="rounded-lg border bg-card p-4 sm:p-6"><div className="h-[320px] w-full" aria-label="Revenue and payment trend chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 12 }} /><YAxis tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} tick={{ fontSize: 12 }} width={75} /><Tooltip {...tooltipProps} formatter={(value: number, name: string) => [money(value), name === "successfulRevenue" ? "Successful revenue" : name === "failedPaymentValue" ? "Failed payment value" : "Volume"]} labelFormatter={formatDate} /><Line type="monotone" dataKey="successfulRevenue" name="Successful revenue" stroke="#0f766e" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="failedPaymentValue" name="Failed payment value" stroke="#dc2626" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="volume" name="Volume" stroke="#2563eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></div>;
}

function FailureChart({ title, items, hour }: { title: string; items: FailureAnalyticsItem[]; hour?: boolean }) {
  if (!items.length) return <div><h3 className="mb-3 text-sm font-medium">{title}</h3><EmptyState /></div>;
  const data = items.map((item) => ({ ...item, label: hour ? `${item.dimension}:00` : String(item.dimension).replace(/_/g, " ") }));
  return <div><h3 className="mb-3 text-sm font-medium">{title}</h3><div className="h-[280px] rounded-lg border bg-card p-4" aria-label={title}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip {...tooltipProps} formatter={(value: number, name: string) => [name === "failedPaymentValue" ? money(value) : number.format(value), name === "failedPaymentValue" ? "Failed value" : "Failed transactions"]} /><Bar dataKey="failedTransactions" name="Failed transactions" fill="#dc2626" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>;
}

function FailureValueChart({ items }: { items: FailureAnalyticsItem[] }) {
  if (!items.length) return null;
  const data = items.map((item) => ({ name: String(item.dimension).replace(/_/g, " "), value: Number(item.failedPaymentValue) || 0 }));
  return <div><h3 className="mb-3 text-sm font-medium">Failed value by payment method</h3><div className="h-[280px] rounded-lg border bg-card p-4" aria-label="Failed value by payment method chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" label={({ name, percent: share }) => `${name} ${(share * 100).toFixed(0)}%`}>{data.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip {...tooltipProps} formatter={(value: number) => money(value)} /></PieChart></ResponsiveContainer></div></div>;
}

export function AnalyticsContent() {
  const results = useQueries({ queries: [
    { queryKey: ["analytics", "overview"], queryFn: () => getAnalyticsOverview() },
    { queryKey: ["analytics", "payment-methods"], queryFn: () => getPaymentMethodAnalytics() },
    { queryKey: ["analytics", "trends"], queryFn: () => getTrendAnalytics() },
    { queryKey: ["analytics", "failures", "paymentMethod"], queryFn: () => getFailureAnalytics("paymentMethod") },
    { queryKey: ["analytics", "failures", "hour"], queryFn: () => getFailureAnalytics("hour") }
  ]});
  const loading = results.some((result) => result.isLoading);
  const error = results.find((result) => result.isError);
  const [overview, methods, trends, failuresByMethod, failuresByHour] = results;

  return <ContentContainer><PageHeader title="Payment Analytics" description="Understand how your payment performance affects revenue." /><div className="mt-8">
    {loading && <div className="space-y-8"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} className="rounded-lg border bg-card p-5"><Skeleton className="h-4 w-28" /><Skeleton className="mt-5 h-8 w-36" /></div>)}</div><Skeleton className="h-64 w-full" /><Skeleton className="h-80 w-full" /></div>}
    {error && <ErrorState message="Unable to load payment analytics. Please try again." />}
    {!loading && !error && overview.data && <><Section title="Overview" description="A summary of payment outcomes for the selected period."><Overview data={overview.data} /></Section><Section title="Payment Method Performance" description="Compare volume and payment outcomes across methods."><PaymentMethods data={methods.data ?? []} /></Section><Section title="Revenue / Payment Trend" description="Track payment volume and revenue over time."><Trends data={trends.data?.items ?? []} /></Section><Section title="Failure Analysis" description="Identify where failed payments are concentrated."><div className="grid gap-6 lg:grid-cols-2"><FailureChart title="Failed transactions by payment method" items={failuresByMethod.data?.items ?? []} /><FailureValueChart items={failuresByMethod.data?.items ?? []} /><FailureChart title="Failed transactions by hour" items={failuresByHour.data?.items ?? []} hour /></div></Section></>}
  </div></ContentContainer>;
}
