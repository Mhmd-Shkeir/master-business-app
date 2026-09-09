import { Link } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { CheckCircleIcon, InboxIcon } from "../components/icons";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useProjects } from "../hooks/useProjects";
import { groupByCurrency } from "../lib/aggregate";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate } from "../lib/format";
import type { ProjectSummary } from "../lib/types";

function AttentionBadges({ project }: { project: ProjectSummary }) {
  const badges: { label: string; className: string }[] = [];
  if (project.needsAttention.overdue) badges.push({ label: "Overdue", className: "bg-red-100 text-red-700" });
  if (project.needsAttention.blockedShipment)
    badges.push({ label: "Payment Hold", className: "bg-red-100 text-red-700" });
  if (project.needsAttention.lowMargin) badges.push({ label: "Low Margin", className: "bg-amber-100 text-amber-700" });
  if (project.needsAttention.missingNextAction)
    badges.push({ label: "No Next Action", className: "bg-neutral-200 text-neutral-700" });

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {badges.map((b) => (
        <span key={b.label} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${b.className}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const SUBTITLE: Record<string, string> = {
  ADMIN: "Business Overview",
  SALES: "Sales Overview",
  PROCUREMENT: "Procurement Overview",
};

function CurrencyCard({ label, amounts }: { label: string; amounts: Map<string, number> }) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      {amounts.size === 0 ? (
        <p className="text-2xl font-semibold">—</p>
      ) : amounts.size === 1 ? (
        <p className="text-2xl font-semibold">{formatCurrency([...amounts.values()][0], [...amounts.keys()][0])}</p>
      ) : (
        <div className="space-y-0.5">
          {[...amounts.entries()].map(([currency, total]) => (
            <p key={currency} className="text-lg font-semibold">
              {formatCurrency(total, currency)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects, isLoading, error, refetch } = useProjects();

  const active = projects ?? [];
  const activeRfqs = active.filter((p) => p.status === "RFQ").length;
  const pendingQuotes = active.filter((p) => p.status === "QUOTED").length;
  const activeOrders = active.filter((p) => p.status === "ORDERED" || p.status === "SHIPPING").length;

  const paymentsDueByCurrency = groupByCurrency(active, "customerBalance");
  const payablesDueByCurrency = groupByCurrency(active, "supplierBalance");

  const attention = active.filter((p) => p.needsAttention.any);
  const recent = [...active].sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate)).slice(0, 5);

  const showPayments = user?.role === "ADMIN" || user?.role === "SALES";
  const showPayables = user?.role === "ADMIN" || user?.role === "PROCUREMENT";

  return (
    <div className="animate-fade-in mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {greeting()}, {user?.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-neutral-400">{SUBTITLE[user?.role ?? ""] ?? "Overview"}</p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "SALES") && (
          <Link
            to="/projects/new"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            + New Project
          </Link>
        )}
      </header>

      {error && <ErrorState message="Failed to load projects." onRetry={() => refetch()} />}

      {isLoading ? (
        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </section>
      ) : (
        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Active RFQs</p>
            <p className="text-2xl font-semibold text-neutral-900">{activeRfqs}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Pending Quotes</p>
            <p className="text-2xl font-semibold text-neutral-900">{pendingQuotes}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Active Orders</p>
            <p className="text-2xl font-semibold text-neutral-900">{activeOrders}</p>
          </div>
          {showPayments && <CurrencyCard label="Payments Due" amounts={paymentsDueByCurrency} />}
          {showPayables && <CurrencyCard label="Payables Due" amounts={payablesDueByCurrency} />}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Needs My Attention {isLoading ? "" : `(${attention.length})`}
        </h2>
        {attention.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
            <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
            Nothing needs attention right now.
          </div>
        ) : (
          <div className="space-y-2">
            {attention.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{p.projectName}</p>
                    <p className="text-xs text-neutral-500">
                      {p.customer?.name} · Due {formatDate(p.dueDate)}
                    </p>
                  </div>
                </div>
                <AttentionBadges project={p} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Recent Projects</h2>
          <Link to="/projects" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            View all projects →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Due</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-4 w-full max-w-sm" />
                    </td>
                  </tr>
                ))}
              {recent.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <InboxIcon className="h-5 w-5 text-neutral-300" />
                      No projects found.
                    </div>
                  </td>
                </tr>
              )}
              {recent.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/projects/${p.id}`} className="font-medium text-neutral-900 hover:underline">
                      {p.projectName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{p.customer?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{p.owner?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatDate(p.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
