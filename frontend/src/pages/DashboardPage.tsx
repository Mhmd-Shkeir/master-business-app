import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { DueDate } from "../components/DueDate";
import { ErrorState } from "../components/ErrorState";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  DollarIcon,
  InboxIcon,
  PaymentsIcon,
  ProjectsIcon,
  SparkleIcon,
  WarningIcon,
} from "../components/icons";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useDailyBrief } from "../hooks/useAI";
import { useProjects } from "../hooks/useProjects";
import { groupByCurrency } from "../lib/aggregate";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate } from "../lib/format";
import type { ProjectStatus, ProjectSummary } from "../lib/types";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

// Splits the brief into its bullet/sentence lines so the Dashboard card can show a
// short preview while the drawer (DailyBriefDrawer) shows the same text in full —
// no backend change, just two presentations of the one string the AI already returns.
function briefLines(brief: string): string[] {
  return brief
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const BRIEF_PREVIEW_LINES = 3;

function DailyBriefCard({
  dailyBrief,
  onViewDetails,
}: {
  dailyBrief: ReturnType<typeof useDailyBrief>;
  onViewDetails: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    try {
      await dailyBrief.mutateAsync();
    } catch (err) {
      setError(extractError(err, "Couldn't generate a brief right now."));
    }
  }

  const lines = dailyBrief.data ? briefLines(dailyBrief.data.brief) : [];
  const preview = lines.slice(0, BRIEF_PREVIEW_LINES);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          <SparkleIcon className="h-3.5 w-3.5" />
          Daily Brief
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={dailyBrief.isPending}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {dailyBrief.isPending ? "Generating..." : dailyBrief.data ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {dailyBrief.data ? (
        <>
          <div className="space-y-1">
            {preview.map((line, i) => (
              <p key={i} className="truncate text-sm text-neutral-700">
                {line}
              </p>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-neutral-400">Generated {formatGeneratedAt(dailyBrief.data.generatedAt)}</p>
            <button
              type="button"
              onClick={onViewDetails}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              View details →
            </button>
          </div>
        </>
      ) : (
        !error && <p className="text-sm text-neutral-400">Generate a summary of what needs attention today.</p>
      )}
    </div>
  );
}

// Full Daily Brief text plus a structured breakdown built from data already on the
// Dashboard (no new backend call) — "Overdue"/"Missing Next Action"/"Payment &
// Supplier Risk" are the same needsAttention flags the summary card and the KPI
// section already use; "Recommended Focus" is the AI's own generated text in full.
function DailyBriefDrawer({
  open,
  onClose,
  dailyBrief,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  dailyBrief: ReturnType<typeof useDailyBrief>;
  projects: ProjectSummary[];
}) {
  const overdue = projects.filter((p) => p.needsAttention.overdue);
  const missingNextAction = projects.filter((p) => p.needsAttention.missingNextAction);
  const risk = projects.filter((p) => p.needsAttention.blockedShipment || p.needsAttention.lowMargin);

  function ProjectRow({ project, note }: { project: ProjectSummary; note: string }) {
    return (
      <Link
        to={`/projects/${project.id}`}
        onClick={onClose}
        className="block rounded-md px-2 py-1.5 hover:bg-neutral-50"
      >
        <p className="truncate text-sm font-medium text-neutral-900">{project.projectName}</p>
        <p className="truncate text-xs text-neutral-400">{note}</p>
      </Link>
    );
  }

  function Section({ title, items }: { title: string; items: ReactNode }) {
    return (
      <div className="mb-5">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
        {items}
      </div>
    );
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <SparkleIcon className="h-4 w-4 text-indigo-600" />
            Daily Brief
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Section
            title={`Overdue (${overdue.length})`}
            items={
              overdue.length === 0 ? (
                <p className="text-sm text-neutral-400">Nothing overdue.</p>
              ) : (
                overdue.map((p) => <ProjectRow key={p.id} project={p} note={`Due ${formatDate(p.dueDate)}`} />)
              )
            }
          />
          <Section
            title={`Missing Next Action (${missingNextAction.length})`}
            items={
              missingNextAction.length === 0 ? (
                <p className="text-sm text-neutral-400">Every active project has a next action set.</p>
              ) : (
                missingNextAction.map((p) => <ProjectRow key={p.id} project={p} note={p.status} />)
              )
            }
          />
          <Section
            title={`Payment / Supplier Risk (${risk.length})`}
            items={
              risk.length === 0 ? (
                <p className="text-sm text-neutral-400">No payment or margin risk flagged.</p>
              ) : (
                risk.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    note={[p.needsAttention.blockedShipment && "Shipment blocked", p.needsAttention.lowMargin && "Low margin (<20%)"].filter(Boolean).join(" · ")}
                  />
                ))
              )
            }
          />
          <Section
            title="Recommended Focus"
            items={
              dailyBrief.data ? (
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{dailyBrief.data.brief}</p>
              ) : (
                <p className="text-sm text-neutral-400">Generate a Daily Brief on the Dashboard to see AI recommendations here.</p>
              )
            }
          />
        </div>
      </div>
    </>
  );
}

const PIPELINE_STAGES: { status: ProjectStatus; label: string; bar: string; dot: string }[] = [
  { status: "RFQ", label: "RFQ", bar: "bg-slate-400", dot: "bg-slate-400" },
  { status: "QUOTED", label: "Quoted", bar: "bg-blue-500", dot: "bg-blue-500" },
  { status: "ORDERED", label: "Ordered", bar: "bg-violet-500", dot: "bg-violet-500" },
  { status: "SHIPPING", label: "Shipping", bar: "bg-amber-500", dot: "bg-amber-500" },
  { status: "CLOSED", label: "Closed", bar: "bg-emerald-500", dot: "bg-emerald-500" },
];

function IconBadge({ icon, tint = "neutral" }: { icon: ReactNode; tint?: "neutral" | "indigo" }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
        tint === "indigo" ? "bg-indigo-50 text-indigo-600" : "bg-neutral-100 text-neutral-400"
      }`}
    >
      {icon}
    </span>
  );
}

function ProjectPipeline({ projects }: { projects: ProjectSummary[] }) {
  const total = projects.length;
  const segments = PIPELINE_STAGES.map((s) => ({
    ...s,
    count: projects.filter((p) => p.status === s.status).length,
  }));

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
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
                {s.label} <span className="font-medium text-neutral-700">{s.count}</span>
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
      emphasize: false,
      count: withMargin.filter((p) => (p.financial!.marginPercent ?? 0) >= 25).length,
    },
    {
      label: "Moderate 20–25%",
      bar: "bg-amber-300",
      emphasize: false,
      count: withMargin.filter((p) => (p.financial!.marginPercent ?? 0) >= 20 && (p.financial!.marginPercent ?? 0) < 25)
        .length,
    },
    {
      label: "Low <20%",
      bar: "bg-amber-600",
      emphasize: true,
      count: withMargin.filter((p) => (p.financial!.marginPercent ?? 0) < 20).length,
    },
  ];
  const avg = total > 0 ? withMargin.reduce((sum, p) => sum + (p.financial!.marginPercent ?? 0), 0) / total : 0;

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
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
              <span className={`w-32 shrink-0 ${b.emphasize ? "font-semibold text-amber-700" : "text-neutral-500"}`}>
                {b.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${(b.count / total) * 100}%` }} />
              </div>
              <span
                className={`w-4 shrink-0 text-right font-medium ${b.emphasize ? "font-semibold text-amber-700" : "text-neutral-700"}`}
              >
                {b.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttentionBadges({ project }: { project: ProjectSummary }) {
  const badges: { label: string; className: string; icon?: ReactNode }[] = [];
  if (project.needsAttention.overdue) badges.push({ label: "Overdue", className: "bg-red-100 text-red-700" });
  if (project.needsAttention.blockedShipment)
    badges.push({ label: "Payment Hold", className: "bg-red-100 text-red-700" });
  if (project.needsAttention.lowMargin)
    badges.push({
      label: "Low Margin",
      className: "bg-amber-100 text-amber-700",
      icon: <WarningIcon className="h-3 w-3" />,
    });
  if (project.needsAttention.missingNextAction)
    badges.push({ label: "No Next Action", className: "bg-neutral-200 text-neutral-700" });

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${b.className}`}
        >
          {b.icon}
          {b.label}
        </span>
      ))}
    </div>
  );
}

function AttentionSummaryCard({
  overdueCount,
  lowMarginCount,
  missingNextActionCount,
  holdCount,
}: {
  overdueCount: number;
  lowMarginCount: number;
  missingNextActionCount: number;
  holdCount: number;
}) {
  const segments = [
    overdueCount > 0 && { text: `${overdueCount} overdue`, className: "text-red-600" },
    holdCount > 0 && { text: `${holdCount} payment hold`, className: "text-red-600" },
    lowMarginCount > 0 && { text: `${lowMarginCount} low margin (<20%)`, className: "text-amber-600" },
    missingNextActionCount > 0 && { text: `${missingNextActionCount} missing next action`, className: "text-neutral-700" },
  ].filter((s): s is { text: string; className: string } => Boolean(s));
  const hasAttention = segments.length > 0;

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
      <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Needs My Attention</h2>
      {hasAttention ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {segments.map((s, i) => (
              <span key={s.text}>
                {i > 0 && <span className="text-neutral-300"> · </span>}
                <span className={s.className}>{s.text}</span>
              </span>
            ))}
          </p>
          <a href="#attention" className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Review →
          </a>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-neutral-400">
          <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
          Nothing needs attention right now.
        </p>
      )}
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const SUBTITLE: Record<string, string> = {
  ADMIN: "Business Overview",
  SALES: "Sales Overview",
  PROCUREMENT: "Procurement Overview",
};

// Net Cash Flow needs both sides (money received from customers, money paid to
// suppliers), so — like Profit Margin — it's Admin-only; Sales/Procurement each
// see only their own half elsewhere (Payments Due / Payables Due). A standalone
// horizontal bar rather than a 6th KPI card — cramming it into that grid left too
// little width for the currency amounts, truncating them.
function NetCashFlowBar({ amounts }: { amounts: Map<string, number> }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <IconBadge icon={<DollarIcon className="h-4 w-4" />} tint="indigo" />
        <div>
          <p className="text-xs font-medium text-neutral-500">Net Cash Flow</p>
          <p className="text-xs text-neutral-400">Received from customers − paid to suppliers</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {amounts.size === 0 ? (
          <p className="text-xl font-semibold text-neutral-900 sm:text-2xl">—</p>
        ) : (
          [...amounts.entries()].map(([currency, total]) => (
            <p key={currency} className={`text-xl font-semibold sm:text-2xl ${total < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {total >= 0 ? "+" : ""}
              {formatCurrency(total, currency)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function CurrencyCard({
  label,
  amounts,
  icon,
  subtitle,
}: {
  label: string;
  amounts: Map<string, number>;
  icon: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-start justify-between">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <IconBadge icon={icon} tint="indigo" />
      </div>
      {amounts.size === 0 ? (
        <p className="text-xl font-semibold text-neutral-900 sm:text-2xl">—</p>
      ) : amounts.size === 1 ? (
        <p className="truncate text-xl font-semibold text-indigo-600 sm:text-2xl">
          {formatCurrency([...amounts.values()][0], [...amounts.keys()][0])}
        </p>
      ) : (
        <div className="space-y-0.5">
          {[...amounts.entries()].map(([currency, total]) => (
            <p key={currency} className="truncate text-base font-semibold text-indigo-600 sm:text-lg">
              {formatCurrency(total, currency)}
            </p>
          ))}
        </div>
      )}
      {subtitle && <p className="mt-0.5 text-xs text-neutral-400">{subtitle}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const dailyBrief = useDailyBrief();
  const [briefDrawerOpen, setBriefDrawerOpen] = useState(false);

  const active = projects ?? [];
  const activeRfqs = active.filter((p) => p.status === "RFQ").length;
  const pendingQuotes = active.filter((p) => p.status === "QUOTED").length;
  const orderedCount = active.filter((p) => p.status === "ORDERED").length;
  const shippingCount = active.filter((p) => p.status === "SHIPPING").length;
  const activeOrders = orderedCount + shippingCount;

  const rfqsWithoutNextAction = active.filter((p) => p.status === "RFQ" && p.needsAttention.missingNextAction).length;
  const quotesOverdue = active.filter((p) => p.status === "QUOTED" && p.needsAttention.overdue).length;

  const paymentsDueByCurrency = groupByCurrency(active, "customerBalance");
  const payablesDueByCurrency = groupByCurrency(active, "supplierBalance");
  const paymentsDueProjectCount = active.filter((p) => (p.financial?.customerBalance ?? 0) > 0).length;
  const payablesDueProjectCount = active.filter((p) => (p.financial?.supplierBalance ?? 0) > 0).length;

  // Net Cash Flow = actual money received from customers minus actual money paid to
  // suppliers — distinct from Profit Margin, which is revenue-vs-cost on paper and
  // doesn't care whether anyone has actually been paid yet.
  const netCashFlowByCurrency = new Map<string, number>();
  for (const [currency, amount] of groupByCurrency(active, "customerPaid")) {
    netCashFlowByCurrency.set(currency, (netCashFlowByCurrency.get(currency) ?? 0) + amount);
  }
  for (const [currency, amount] of groupByCurrency(active, "supplierPaid")) {
    netCashFlowByCurrency.set(currency, (netCashFlowByCurrency.get(currency) ?? 0) - amount);
  }

  const attention = active.filter((p) => p.needsAttention.any);
  const overdueCount = active.filter((p) => p.needsAttention.overdue).length;
  const lowMarginCount = active.filter((p) => p.needsAttention.lowMargin).length;
  const missingNextActionCount = active.filter((p) => p.needsAttention.missingNextAction).length;
  const holdCount = active.filter((p) => p.needsAttention.blockedShipment).length;
  const recent = [...active].sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate)).slice(0, 5);

  const showPayments = user?.role === "ADMIN" || user?.role === "SALES";
  const showPayables = user?.role === "ADMIN" || user?.role === "PROCUREMENT";
  const showNetCashFlow = user?.role === "ADMIN";
  const kpiCardCount = 3 + (showPayments ? 1 : 0) + (showPayables ? 1 : 0);
  // Auto-fit instead of fixed breakpoint column counts: a fixed lg:grid-cols-5 looks
  // fine with short numbers but truncates as soon as a currency value grows past a
  // few digits, since the actual available width (viewport minus the 256px sidebar)
  // doesn't scale with the breakpoint name. Auto-fit reflows by real available width
  // at any window size instead of us guessing one breakpoint that happens to work.
  const kpiGridCols = "grid-cols-[repeat(auto-fit,minmax(180px,1fr))]";

  return (
    <div className="animate-fade-in w-full px-8 py-6">
      <header className="mb-6 rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {greeting()}, {user?.name.split(" ")[0]}
              <span className="ml-2 font-normal text-neutral-400">— {formatLongDate()}</span>
            </h1>
            <p className="text-sm text-neutral-400">{SUBTITLE[user?.role ?? ""] ?? "Overview"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
              <a
                href="#overview"
                className="rounded-md px-3 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 hover:shadow-sm"
              >
                Overview
              </a>
              <a
                href="#attention"
                className="rounded-md px-3 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 hover:shadow-sm"
              >
                Attention
              </a>
              <a
                href="#pipeline"
                className="rounded-md px-3 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 hover:shadow-sm"
              >
                Pipeline
              </a>
              <a
                href="#projects"
                className="rounded-md px-3 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 hover:shadow-sm"
              >
                Projects
              </a>
            </nav>

            {(user?.role === "ADMIN" || user?.role === "SALES") && (
              <Link
                to="/projects/new"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                + New Project
              </Link>
            )}
          </div>
        </div>
      </header>

      {error && <ErrorState message="Failed to load projects." onRetry={() => refetch()} />}

      {!isLoading && (
        <div className="mb-8 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <AttentionSummaryCard
            overdueCount={overdueCount}
            lowMarginCount={lowMarginCount}
            missingNextActionCount={missingNextActionCount}
            holdCount={holdCount}
          />
          <DailyBriefCard dailyBrief={dailyBrief} onViewDetails={() => setBriefDrawerOpen(true)} />
        </div>
      )}

      <DailyBriefDrawer
        open={briefDrawerOpen}
        onClose={() => setBriefDrawerOpen(false)}
        dailyBrief={dailyBrief}
        projects={active}
      />

      <section id="overview" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Business KPIs</h2>
        {isLoading ? (
          <div className={`grid gap-4 ${kpiGridCols}`}>
            {Array.from({ length: kpiCardCount }).map((_, i) => (
              <div key={i} className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-7 w-14" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-4 ${kpiGridCols}`}>
            <div className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <p className="text-xs font-medium text-neutral-500">Active RFQs</p>
                <IconBadge icon={<ProjectsIcon className="h-4 w-4" />} />
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{activeRfqs}</p>
              {rfqsWithoutNextAction > 0 && (
                <p className="mt-0.5 text-xs text-neutral-400">{rfqsWithoutNextAction} without next action</p>
              )}
            </div>
            <div className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <p className="text-xs font-medium text-neutral-500">Pending Quotes</p>
                <IconBadge icon={<ClockIcon className="h-4 w-4" />} />
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{pendingQuotes}</p>
              {quotesOverdue > 0 && <p className="mt-0.5 text-xs text-neutral-400">{quotesOverdue} overdue</p>}
            </div>
            <div className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <p className="text-xs font-medium text-neutral-500">Active Orders</p>
                <IconBadge icon={<PaymentsIcon className="h-4 w-4" />} />
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{activeOrders}</p>
              {activeOrders > 0 && (
                <p className="mt-0.5 text-xs text-neutral-400">
                  {orderedCount} ordered · {shippingCount} shipping
                </p>
              )}
            </div>
            {showPayments && (
              <CurrencyCard
                label="Payments Due"
                amounts={paymentsDueByCurrency}
                icon={<DollarIcon className="h-4 w-4" />}
                subtitle={
                  paymentsDueProjectCount > 0
                    ? `${paymentsDueProjectCount} project${paymentsDueProjectCount === 1 ? "" : "s"}`
                    : undefined
                }
              />
            )}
            {showPayables && (
              <CurrencyCard
                label="Payables Due"
                amounts={payablesDueByCurrency}
                icon={<InboxIcon className="h-4 w-4" />}
                subtitle={
                  payablesDueProjectCount > 0
                    ? `${payablesDueProjectCount} project${payablesDueProjectCount === 1 ? "" : "s"}`
                    : undefined
                }
              />
            )}
          </div>
        )}
      </section>

      {showNetCashFlow && !isLoading && <NetCashFlowBar amounts={netCashFlowByCurrency} />}

      <section id="attention">
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
                className="flex flex-col gap-3 rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.customer?.name ?? p.projectName} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-neutral-900">{p.projectName}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="truncate text-xs text-neutral-500">
                      {p.customer?.name} · Due {formatDate(p.dueDate)}
                      {(p.financial?.estimatedRevenue ?? p.financial?.estimatedCost) != null &&
                        ` · ${formatCurrency(p.financial?.estimatedRevenue ?? p.financial?.estimatedCost, p.financial?.currency)}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
                  <AttentionBadges project={p} />
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-neutral-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="pipeline" className="mt-8">
        {!isLoading && active.length > 0 && (
          <div className={`grid grid-cols-1 gap-4 ${user?.role === "ADMIN" ? "lg:grid-cols-2" : ""}`}>
            <ProjectPipeline projects={active} />
            {user?.role === "ADMIN" && <MarginHealth projects={active} />}
          </div>
        )}
      </section>

      <section id="projects" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Recent Projects</h2>
          <Link to="/projects" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            View all projects →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
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
                    <p className="font-mono text-xs text-neutral-400">{p.id.slice(-8).toUpperCase()}</p>
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
                  <td className="px-4 py-2.5 text-neutral-600">
                    <DueDate date={p.dueDate} overdue={p.needsAttention.overdue} />
                  </td>
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
        </div>
      </section>
    </div>
  );
}
