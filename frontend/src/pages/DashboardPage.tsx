import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { ErrorState } from "../components/ErrorState";
import { CheckCircleIcon, InboxIcon } from "../components/icons";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useProjects } from "../hooks/useProjects";
import { groupByCurrency } from "../lib/aggregate";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate } from "../lib/format";
import type { ProjectStatus, ProjectSummary } from "../lib/types";

const PIPELINE_STAGES: { status: ProjectStatus; bar: string; dot: string }[] = [
  { status: "RFQ", bar: "bg-slate-400", dot: "bg-slate-400" },
  { status: "QUOTED", bar: "bg-blue-500", dot: "bg-blue-500" },
  { status: "ORDERED", bar: "bg-violet-500", dot: "bg-violet-500" },
  { status: "SHIPPING", bar: "bg-amber-500", dot: "bg-amber-500" },
  { status: "CLOSED", bar: "bg-emerald-500", dot: "bg-emerald-500" },
];

function ProjectPipeline({ projects }: { projects: ProjectSummary[] }) {
  const total = projects.length;
  const segments = PIPELINE_STAGES.map((s) => ({
    ...s,
    count: projects.filter((p) => p.status === s.status).length,
  }));

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Project Pipeline</h2>
        <span className="text-xs text-neutral-400">{total} total projects</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-neutral-400">No projects yet.</p>
      ) : (
        <>
          <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.status} className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {segments.map((s) => (
              <span key={s.status} className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.status.charAt(0) + s.status.slice(1).toLowerCase()} <span className="font-medium text-neutral-700">{s.count}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MarginHealth({ projects }: { projects: ProjectSummary[] }) {
  const withMargin = projects.filter((p) => p.financial?.marginPercent != null);
  const total = withMargin.length;
  const buckets = [
    {
      label: "Healthy ≥25%",
      bar: "bg-emerald-500",
      count: withMargin.filter((p) => (p.financial!.marginPercent ?? 0) >= 25).length,
    },
    {
      label: "Moderate 20–25%",
      bar: "bg-amber-500",
      count: withMargin.filter((p) => (p.financial!.marginPercent ?? 0) >= 20 && (p.financial!.marginPercent ?? 0) < 25)
        .length,
    },
    {
      label: "Low <20%",
      bar: "bg-red-500",
      count: withMargin.filter((p) => (p.financial!.marginPercent ?? 0) < 20).length,
    },
  ];
  const avg = total > 0 ? withMargin.reduce((sum, p) => sum + (p.financial!.marginPercent ?? 0), 0) / total : 0;

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Margin Health</h2>
        {total > 0 && <span className="text-xs text-neutral-400">{avg.toFixed(1)}% avg</span>}
      </div>
      {total === 0 ? (
        <p className="text-sm text-neutral-400">No margin data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-xs">
              <span className="w-32 shrink-0 text-neutral-500">{b.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${(b.count / total) * 100}%` }} />
              </div>
              <span className="w-4 shrink-0 text-right font-medium text-neutral-700">{b.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <p className="text-2xl font-semibold text-neutral-900">—</p>
      ) : amounts.size === 1 ? (
        <p className="text-2xl font-semibold text-indigo-600">
          {formatCurrency([...amounts.values()][0], [...amounts.keys()][0])}
        </p>
      ) : (
        <div className="space-y-0.5">
          {[...amounts.entries()].map(([currency, total]) => (
            <p key={currency} className="text-lg font-semibold text-indigo-600">
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
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
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

      {!isLoading && active.length > 0 && (
        <section className={`mb-8 grid grid-cols-1 gap-4 ${user?.role === "ADMIN" ? "lg:grid-cols-2" : ""}`}>
          <ProjectPipeline projects={active} />
          {user?.role === "ADMIN" && <MarginHealth projects={active} />}
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
                  <Avatar name={p.customer?.name ?? p.projectName} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">{p.projectName}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-neutral-500">
                      {p.customer?.name} · Due {formatDate(p.dueDate)}
                      {(p.financial?.estimatedRevenue ?? p.financial?.estimatedCost) != null &&
                        ` · ${formatCurrency(p.financial?.estimatedRevenue ?? p.financial?.estimatedCost, p.financial?.currency)}`}
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
                <th className="px-4 py-2.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full max-w-sm" />
                    </td>
                  </tr>
                ))}
              {recent.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
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
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-neutral-600">
                      {p.customer?.name && <Avatar name={p.customer.name} />}
                      {p.customer?.name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{p.owner?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-2.5 text-right text-neutral-600">
                    {p.financial?.estimatedRevenue != null || p.financial?.estimatedCost != null
                      ? formatCurrency(p.financial?.estimatedRevenue ?? p.financial?.estimatedCost, p.financial?.currency)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
