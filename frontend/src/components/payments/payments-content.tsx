"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/states/error-state";
import {
  getPayment,
  getPayments,
  type PaymentDetails,
  type PaymentListItem,
} from "@/lib/payments-api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const money = (value: string) => currency.format(Number(value) || 0);
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const methodLabel = (value: string) =>
  value === "net_banking" ? "Net Banking" : value.toUpperCase();
const statusLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "succeeded"
      ? "bg-emerald-50 text-emerald-700"
      : status === "failed"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="flex animate-pulse gap-4">
          <div className="h-10 flex-1 rounded bg-muted" />
          <div className="h-10 w-24 rounded bg-muted" />
          <div className="h-10 w-24 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function PaymentDrawer({
  paymentId,
  onClose,
}: {
  paymentId: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => getPayment(paymentId),
  });
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close payment details"
        className="absolute inset-0 bg-primary/30"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-lg overflow-y-auto border-l bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Operations
            </p>
            <h2 className="mt-1 text-xl font-semibold">Payment Details</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {query.isLoading && <SkeletonRows />}
        {query.isError && (
          <div className="py-8">
            <ErrorState message="Unable to load payment details." />
          </div>
        )}
        {query.data && <PaymentDetailBody payment={query.data} />}
      </aside>
    </div>
  );
}

function PaymentDetailBody({ payment }: { payment: PaymentDetails }) {
  const recovered =
    payment.status === "succeeded" && payment.attempts.length > 1;
  const recoverySignal =
    payment.status === "failed" && payment.attempts.length > 1;
  return (
    <div className="space-y-7 pt-6">
      <div className="grid grid-cols-2 gap-5">
        <Detail label="Payment ID" value={payment.externalId} mono />
        <Detail label="Amount" value={money(payment.amount)} strong />
        <Detail
          label="Status"
          value={<StatusBadge status={payment.status} />}
        />
        <Detail
          label="Payment Method"
          value={methodLabel(payment.paymentMethod)}
        />
        <Detail
          label="Customer"
          value={payment.customerName || payment.customerExternalId || "—"}
        />
        <Detail label="Created" value={dateTime(payment.createdAt)} />
      </div>
      {recoverySignal && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Recovery Signal</p>
          <p className="mt-1 text-sm text-amber-800">
            This payment has been attempted {payment.attempts.length} times and
            remains unsuccessful.
          </p>
        </div>
      )}
      {recovered && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900">Recovered Payment</p>
          <p className="mt-1 text-sm text-emerald-800">
            This payment succeeded after {payment.attempts.length} attempts.
          </p>
        </div>
      )}
      <section>
        <h3 className="font-semibold">Payment Attempts</h3>
        <div className="mt-4 space-y-0">
          {payment.attempts.map((attempt, index) => (
            <div
              key={attempt.id}
              className="relative flex gap-4 pb-6 last:pb-0"
            >
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 h-3 w-3 rounded-full ${attempt.status === "succeeded" ? "bg-emerald-500" : attempt.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`}
                />
                {index < payment.attempts.length - 1 && (
                  <span className="mt-1 h-full w-px bg-border" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Attempt {attempt.attemptNumber}</p>
                  <span className="text-xs text-muted-foreground">
                    {dateTime(attempt.processedAt || attempt.createdAt)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={attempt.status} />
                  {attempt.providerPaymentId && (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {attempt.providerPaymentId}
                    </span>
                  )}
                </div>
                {(attempt.errorMessage || attempt.errorCode) && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {attempt.errorMessage || attempt.errorCode}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Provider: {payment.provider}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={`mt-1 text-sm ${mono ? "font-mono break-all" : ""} ${strong ? "text-lg font-semibold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export function PaymentsContent() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["payments", { search, status, paymentMethod, from, to, page }],
    queryFn: () =>
      getPayments({
        search,
        status,
        paymentMethod,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        page,
        pageSize: 25,
      }),
  });
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentMethod("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const summary = query.data?.summary;
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Payment operations"
        title="Payments"
        description="Monitor transactions, payment status, and recovery attempts."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </>
        }
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total payments", summary?.totalPayments ?? 0],
          ["Successful", summary?.successfulPayments ?? 0],
          ["Failed", summary?.failedPayments ?? 0],
          ["Payment value", summary ? money(summary.totalPaymentValue) : "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search payment or customer ID"
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All methods</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="net_banking">Net Banking</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 w-full rounded-md border bg-background px-2 text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 w-full rounded-md border bg-background px-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Date range
          </span>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border bg-card">
        {query.isLoading && <SkeletonRows />}
        {query.isError && (
          <div className="p-6">
            <ErrorState message="Unable to load payments. Please try again." />
          </div>
        )}
        {query.data && query.data.items.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
            <div className="rounded-full bg-accent/10 p-3 text-accent">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-semibold">No payments yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Payment activity will appear here once transactions are available.
            </p>
          </div>
        )}
        {query.data && query.data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {[
                      "Customer",
                      "Amount",
                      "Method",
                      "Status",
                      "Attempts",
                      "Created",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-5 py-3 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.items.map((payment) => (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                      onSelect={setSelectedId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
              <span>
                Page {query.data.pagination.page} of{" "}
                {query.data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !query.data.pagination.hasPreviousPage || query.isFetching
                  }
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !query.data.pagination.hasNextPage || query.isFetching
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {selectedId && (
        <PaymentDrawer
          paymentId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </ContentContainer>
  );
}

function PaymentRow({
  payment,
  onSelect,
}: {
  payment: PaymentListItem;
  onSelect: (id: string) => void;
}) {
  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => onSelect(payment.id)}
    >
      <td className="px-5 py-4">
        <p className="font-medium">{payment.customerName || "—"}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {payment.customerExternalId || payment.customerId || "—"}
        </p>
      </td>
      <td className="whitespace-nowrap px-5 py-4 font-semibold">
        {money(payment.amount)}
      </td>
      <td className="px-5 py-4">{methodLabel(payment.paymentMethod)}</td>
      <td className="px-5 py-4">
        <StatusBadge status={payment.status} />
      </td>
      <td className="px-5 py-4">{payment.attemptCount}</td>
      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
        {dateTime(payment.createdAt)}
      </td>
      <td className="px-5 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(payment.id);
          }}
        >
          <Eye className="mr-1.5 h-4 w-4" />
          View
        </Button>
      </td>
    </tr>
  );
}
