import { Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
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
    <div className="flex gap-1.5">
      {badges.map((b) => (
        <span key={b.label} className={`rounded px-2 py-0.5 text-xs font-medium ${b.className}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { data: projects, isLoading, error } = useProjects();

  const active = projects ?? [];
  const activeRfqs = active.filter((p) => p.status === "RFQ").length;
  const pendingQuotes = active.filter((p) => p.status === "QUOTED").length;
  const activeOrders = active.filter((p) => p.status === "ORDERED" || p.status === "SHIPPING").length;

  const balances = active.map((p) => p.financial?.customerBalance).filter((v): v is number => v != null);
  const paymentsDue = balances.length > 0 ? balances.reduce((sum, v) => sum + v, 0) : null;

  const attention = active.filter((p) => p.needsAttention.any);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Dashboard</h1>
        <Link
          to="/projects/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + New Project
        </Link>
      </header>

      {isLoading && (
        <p className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Loading dashboard...
        </p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">Failed to load projects.</p>}

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Active RFQs</p>
          <p className="text-2xl font-semibold">{isLoading ? "—" : activeRfqs}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Pending Quotes</p>
          <p className="text-2xl font-semibold">{isLoading ? "—" : pendingQuotes}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Active Orders</p>
          <p className="text-2xl font-semibold">{isLoading ? "—" : activeOrders}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Payments Due</p>
          <p className="text-2xl font-semibold">{paymentsDue == null ? "—" : formatCurrency(paymentsDue)}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Needs My Attention {isLoading ? "" : `(${attention.length})`}
        </h2>
        {attention.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-400">
            Nothing needs attention right now.
          </div>
        ) : (
          <div className="space-y-2">
            {attention.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{p.projectName}</p>
                  <p className="text-xs text-neutral-500">
                    {p.customer?.name} · {p.status} · Due {formatDate(p.dueDate)}
                  </p>
                </div>
                <AttentionBadges project={p} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">All Projects</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {active.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link to={`/projects/${p.id}`} className="font-medium text-neutral-900 hover:underline">
                      {p.projectName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{p.customer?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{p.status}</td>
                  <td className="px-4 py-2 text-neutral-600">{p.owner?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{formatDate(p.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
