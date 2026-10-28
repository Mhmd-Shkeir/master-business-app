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

// Each side remains isolated by role. Cross-currency totals are never added.
function PaymentTable({
  title, side, projects,
}: {
  title: string;
  side: "customer" | "supplier";
  projects: ProjectSummary[];
}) {
  const { user } = useAuth();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const balanceField = side === "customer" ? "customerBalance" : "supplierBalance";
  const paidField = side === "customer" ? "customerPaid" : "supplierPaid";
  const active = projects.filter(p => (p.financial?.[balanceField] ?? 0) > 0);
  const totals = groupByCurrency(active, balanceField);

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>

      <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-neutral-500">Outstanding</p>
          <div className="text-right text-[11px] text-neutral-400">
            <p>Total</p>
            <p>Per currency — never combined</p>
          </div>
        </div>
        <div className="mt-1 space-y-1">
          {[...totals.entries()].map(([currency, value]) => (
            <p key={currency} className="text-lg font-semibold text-indigo-600">
              {formatCurrency(value, currency)}
              <span className="ml-2 text-xs font-medium text-neutral-400">({currency})</span>
            </p>
          ))}
          {totals.size === 0 && <p className="text-sm text-neutral-500">No outstanding balances</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="bg-neutral-50 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className="px-3 py-3">Project</th>
                <th scope="col" className="px-3 py-3">Party</th>
                <th scope="col" className="px-3 py-3 text-right">Paid</th>
                <th scope="col" className="px-3 py-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-400">Nothing outstanding.</td></tr>
              )}
              {active.map(p => {
                const currency = p.financial?.currency ?? "USD";
                const canRecord = user?.role === "ADMIN" || p.status !== "CLOSED";
                return (
                  <tr key={p.id} className="border-t border-neutral-100 align-top">
                    <td className="px-3 py-3">
                      <Link className="font-medium text-neutral-900 hover:text-indigo-600 hover:underline" to={`/projects/${p.id}`}>{p.projectName}</Link>
                      {canRecord && openFor !== p.id && (
                        <button type="button" className="mt-1 block text-xs font-medium text-indigo-600 hover:underline" onClick={() => setOpenFor(p.id)}>
                          Record payment
                        </button>
                      )}
                      {openFor === p.id && (
                        <div className="mt-2 min-w-[220px]">
                          <RecordPaymentForm project={p} side={side} onDone={() => setOpenFor(null)} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-neutral-600">{side === "customer" ? p.customer?.name : p.supplier?.name}</td>
                    <td className="px-3 py-3 text-right text-neutral-600">{formatCurrency(p.financial?.[paidField], currency)}</td>
                    <td className="px-3 py-3 text-right font-medium text-neutral-800">{formatCurrency(p.financial?.[balanceField], currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-neutral-400">Open a project to view its Financial Overview or record a payment here.</p>
    </section>
  );
}

export function PaymentsPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useProjects();
  const projects = data ?? [];
  const receivables = user?.role === "ADMIN" || user?.role === "SALES";
  const payables = user?.role === "ADMIN" || user?.role === "PROCUREMENT";

  return (
    <div className="animate-fade-in w-full px-4 py-5 sm:px-8 sm:py-6">
      <PageHeader title="Payments" subtitle="Track receivables and payables across active projects" />
      {isLoading && <p className="text-sm text-neutral-400">Loading...</p>}
      {error && <ErrorState message="Failed to load payments." onRetry={() => refetch()} />}
      {!error && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          {receivables && <PaymentTable title="Customer Receivables" side="customer" projects={projects} />}
          {payables && <PaymentTable title="Supplier Payables" side="supplier" projects={projects} />}
        </div>
      )}
    </div>
  );
}
