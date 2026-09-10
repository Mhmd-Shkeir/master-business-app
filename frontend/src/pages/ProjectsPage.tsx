import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { DueDate } from "../components/DueDate";
import { ErrorState } from "../components/ErrorState";
import { DownloadIcon, InboxIcon } from "../components/icons";
import { StatusBadge } from "../components/StatusBadge";
import { useProjects } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate } from "../lib/format";
import type { ProjectStatus, ProjectSummary } from "../lib/types";

const STATUS_OPTIONS: (ProjectStatus | "ALL")[] = ["ALL", "RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportProjectsCsv(projects: ProjectSummary[]) {
  const header = ["Project", "Customer", "Status", "Owner", "Due Date", "Value", "Currency"];
  const rows = projects.map((p) => {
    const value = p.financial?.estimatedRevenue ?? p.financial?.estimatedCost;
    return [
      p.projectName,
      p.customer?.name ?? "",
      p.status,
      p.owner?.name ?? "",
      formatDate(p.dueDate),
      value != null ? String(value) : "",
      value != null ? (p.financial?.currency ?? "") : "",
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ProjectsPage() {
  const { user } = useAuth();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");

  const active = projects ?? [];
  const filtered = active.filter((p) => {
    const matchesStatus = status === "ALL" || p.status === status;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q === "" || p.projectName.toLowerCase().includes(q) || (p.customer?.name ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="animate-fade-in mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Projects</h1>
          <p className="text-sm text-neutral-400">
            Manage customer requests, quotations, orders, shipping, and closed projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportProjectsCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Export
          </button>
          {(user?.role === "ADMIN" || user?.role === "SALES") && (
            <Link
              to="/projects/new"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              + New Project
            </Link>
          )}
        </div>
      </header>

      {error && <ErrorState message="Failed to load projects." onRetry={() => refetch()} />}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects or customers..."
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "ALL")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-indigo-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All Statuses" : s}
            </option>
          ))}
        </select>
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
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  <div className="flex flex-col items-center gap-2">
                    <InboxIcon className="h-5 w-5 text-neutral-300" />
                    No projects found.
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((p) => (
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
  );
}
