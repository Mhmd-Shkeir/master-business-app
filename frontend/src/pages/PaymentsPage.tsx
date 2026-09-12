import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/PageHeader";
import { RecordPaymentForm } from "../components/RecordPaymentForm";
import { useProjects } from "../hooks/useProjects";
import { groupByCurrency } from "../lib/aggregate";
import { useAuth } from "../lib/auth-context";
import { formatCurrency } from "../lib/format";
import type { ProjectSummary } from "../lib/types";

function Section({
  title,
  side,
  projects,
  balanceField,
  paidField,
}: {
  title: string;
  side: "customer" | "supplier";
  projects: ProjectSummary[];
  balanceField: "customerBalance" | "supplierBalance";
  paidField: "customerPaid" | "supplierPaid";
}) {
  const { user } = useAuth();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const outstanding = projects.filter((p) => (p.financial?.[balanceField] ?? 0) > 0);
  const totalByCurrency = groupByCurrency(projects, balanceField);
  const paidByCurrency = groupByCurrency(projects, paidField === "customerPaid" ? "actualRevenue" : "actualCost");

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">Outstanding</p>
          {[...totalByCurrency.entries()].map(([c, v]) => (
            <p key={c} className="truncate text-lg font-semibold text-neutral-900 sm:text-xl">
              {formatCurrency(v, c)}
            </p>
          ))}
          {totalByCurrency.size === 0 && <p className="truncate text-lg font-semibold text-neutral-900 sm:text-xl">—</p>}
        </div>
        <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">Total</p>
          {[...paidByCurrency.entries()].map(([c, v]) => (
            <p key={c} className="truncate text-lg font-semibold text-neutral-900 sm:text-xl">
              {formatCurrency(v, c)}
            </p>
          ))}
          {paidByCurrency.size === 0 && <p className="truncate text-lg font-semibold text-neutral-900 sm:text-xl">—</p>}
        </div>
      </div>

      {outstanding.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing outstanding.</p>
      ) : (
        <div className="space-y-2">
          {outstanding.map((p) => (
            <div key={p.id} className="rounded-xl border border-neutral-200/70 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/projects/${p.id}`} className="truncate text-sm font-medium text-neutral-900 hover:underline">
                    {p.projectName}
                  </Link>
                  <p className="truncate text-xs text-neutral-500">
                    {side === "customer" ? p.customer?.name : p.supplier?.name} ·{" "}
                    {formatCurrency(p.financial?.[balanceField], p.financial?.currency)} outstanding
                  </p>
                </div>
                {openFor !== p.id && (user?.role === "ADMIN" || p.status !== "CLOSED") && (
                  <button
                    type="button"
                    onClick={() => setOpenFor(p.id)}
                    className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
                  >
                    Record Payment
                  </button>
                )}
              </div>
              {openFor === p.id && (
                <div className="mt-3">
                  <RecordPaymentForm project={p} side={side} onDone={() => setOpenFor(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PaymentsPage() {
  const { user } = useAuth();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const active = projects ?? [];

  const showReceivables = user?.role === "ADMIN" || user?.role === "SALES";
  const showPayables = user?.role === "ADMIN" || user?.role === "PROCUREMENT";

  return (
    <div className="animate-fade-in w-full px-8 py-6">
      <PageHeader title="Payments" subtitle="Track receivables and payables across active projects" />

      {isLoading && <p className="text-sm text-neutral-400">Loading...</p>}
      {error && <ErrorState message="Failed to load payments." onRetry={() => refetch()} />}

      {showReceivables && (
        <Section
          title="Customer Receivables"
          side="customer"
          projects={active}
          balanceField="customerBalance"
          paidField="customerPaid"
        />
      )}
      {showPayables && (
        <Section
          title="Supplier Payables"
          side="supplier"
          projects={active}
          balanceField="supplierBalance"
          paidField="supplierPaid"
        />
      )}
    </div>
  );
}
