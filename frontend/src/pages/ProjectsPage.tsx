import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { InboxIcon } from "../components/icons";
import { StatusBadge } from "../components/StatusBadge";
import { useProjects } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import { formatDate } from "../lib/format";
import type { ProjectStatus } from "../lib/types";

const STATUS_OPTIONS: (ProjectStatus | "ALL")[] = ["ALL", "RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

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
        <h1 className="text-lg font-semibold text-neutral-900">Projects</h1>
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

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects or customers..."
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/5"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "ALL")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-neutral-500"
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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
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
    </div>
  );
}
